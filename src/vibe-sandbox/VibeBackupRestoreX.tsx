import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { get, set } from 'idb-keyval';
import { Save, RotateCcw, AlertTriangle, X, DatabaseBackup } from 'lucide-react';
import { toast } from 'sonner';
import { store, Flashcard } from '../lib/store';
import { cn } from '../lib/utils';
// @ts-ignore
import { OfflineSyncQueue } from '../lib/offlineSync';

interface BackupData {
  deckId: string;
  hardCardIds: string[];
  updatedAt: number;
}

interface VibeBackupRestoreXProps {
  deckId: string;
  deckTitle: string;
  cards: Flashcard[];
  onRestored?: () => void;
  className?: string;
}

export function VibeBackupRestoreX({ deckId, deckTitle, cards, onRestored, className }: VibeBackupRestoreXProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmingRestore, setIsConfirmingRestore] = useState(false);
  const [lastBackup, setLastBackup] = useState<BackupData | null>(null);

  const fetchBackup = async () => {
    try {
      const data = await get(`vibe_backup_x_${deckId}`);
      if (data) {
        setLastBackup(data as BackupData);
      }
    } catch (e) {
      console.error('Failed to fetch backup', e);
    }
  };

  const handleOpen = () => {
    fetchBackup();
    setIsOpen(true);
  };

  const handleBackup = async () => {
    try {
      const hardCardIds = cards.filter((c) => c.isHard).map((c) => c.id);
      
      const backupData: BackupData = {
        deckId,
        hardCardIds,
        updatedAt: Date.now(),
      };
      
      await set(`vibe_backup_x_${deckId}`, backupData);
      setLastBackup(backupData);
      toast.success(`Đã sao lưu ${hardCardIds.length} thẻ khó của mục "${deckTitle}"`);
      setIsOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('Lỗi khi sao lưu dữ liệu.');
    }
  };

  const handleRestore = async () => {
    if (!lastBackup) return;

    try {
      const currentUser = store.getCurrentUser();
      
      let updatedCount = 0;
      cards.forEach((card) => {
        const shouldBeHard = lastBackup.hardCardIds.includes(card.id);
        if (card.isHard !== shouldBeHard) {
          card.isHard = shouldBeHard;
          updatedCount++;
          
          if (currentUser) {
            OfflineSyncQueue.enqueueCardState(currentUser.id, card.id, {
              isWeakCard: shouldBeHard
            });
          }
        }
      });
      
      // Save locally to persist state without reload
      store.setDecksLocally(store.getDecks());
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent("henosis-data-synced"));
      }

      toast.success(`Đã khôi phục ${lastBackup.hardCardIds.length} thẻ khó (cập nhật ${updatedCount} thẻ)`);
      if (onRestored) onRestored();
      setIsOpen(false);
      setIsConfirmingRestore(false);
    } catch (e) {
      console.error(e);
      toast.error('Lỗi khi khôi phục dữ liệu.');
    }
  };

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={handleOpen}
        className="flex items-center justify-center p-2 rounded-full bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-800/40 text-purple-600 dark:text-purple-400 transition-colors"
        title="Sao lưu/Khôi phục thẻ đánh dấu X"
      >
        <DatabaseBackup className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsOpen(false);
                setIsConfirmingRestore(false);
              }}
              className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute right-0 top-full mt-2 w-64 z-50 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            >
              <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Snapshots Thẻ X</span>
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>

              <div className="p-2 space-y-1">
                <button
                  onClick={handleBackup}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-700 dark:text-purple-400 transition-colors text-left"
                >
                  <Save className="w-4 h-4" />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">Lưu trạng thái hiện tại</span>
                    <span className="text-xs opacity-80">Sẽ ghi đè bản sao lưu cũ</span>
                  </div>
                </button>

                <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

                {!isConfirmingRestore ? (
                  <button
                    onClick={() => setIsConfirmingRestore(true)}
                    disabled={!lastBackup}
                    className={cn(
                      "w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors",
                      lastBackup 
                        ? "hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-700 dark:text-orange-400" 
                        : "opacity-50 cursor-not-allowed text-zinc-500"
                    )}
                  >
                    <RotateCcw className="w-4 h-4" />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">Khôi phục trạng thái</span>
                      <span className="text-xs opacity-80">
                        {lastBackup 
                          ? `Bản lưu: ${new Date(lastBackup.updatedAt).toLocaleTimeString('vi-VN')} (${lastBackup.hardCardIds.length} thẻ)` 
                          : "Chưa có bản sao lưu nào"}
                      </span>
                    </div>
                  </button>
                ) : (
                  <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className="flex items-start gap-2 mb-2 text-orange-800 dark:text-orange-300">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span className="text-xs font-medium">Hành động này sẽ ghi đè toàn bộ đánh dấu X hiện tại bằng bản sao lưu.</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleRestore}
                        className="flex-1 py-1 px-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded"
                      >
                        Chắc chắn
                      </button>
                      <button
                        onClick={() => setIsConfirmingRestore(false)}
                        className="flex-1 py-1 px-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
