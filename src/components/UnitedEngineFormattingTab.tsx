import React, { useState } from "react";
import { store, Deck, Flashcard } from "../lib/store";
import { optimizeFormatting } from "../formatting/formattingClient";
import { CustomDeckSelect } from "./CustomDeckSelect";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { Loader2, CheckCircle, Save, XCircle } from "lucide-react";
// @ts-ignore
import { OfflineSyncQueue } from "../lib/offlineSync";

export function UnitedEngineFormattingTab() {
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [formattedCards, setFormattedCards] = useState<{ id: string; oldFront: string; oldBack: string; newFront: string; newBack: string }[] | null>(null);

  React.useEffect(() => {
    const targetDeckId = sessionStorage.getItem("united_engine_target_deck");
    if (targetDeckId) {
      setSelectedDeckId(targetDeckId);
      sessionStorage.removeItem("united_engine_target_deck");
    }
  }, []);

  const handleFormat = async () => {
    if (!selectedDeckId) {
      toast.error("Vui lòng chọn một bộ thẻ.");
      return;
    }
    const deck = store.getDeck(selectedDeckId);
    if (!deck || !deck.cards || deck.cards.length === 0) {
      toast.error("Bộ thẻ trống.");
      return;
    }

    setIsProcessing(true);
    try {
      // Use batch optimization for much faster processing
      const textsToFormat = deck.cards.map(c => c.back || "");
      
      // Import optimizeFormattingBatch if not already imported
      const { optimizeFormattingBatch } = await import("../formatting/formattingClient");
      const formattedTexts = await optimizeFormattingBatch(textsToFormat);
      
      const results = deck.cards.map((card, idx) => ({
        id: card.id,
        oldFront: card.front,
        oldBack: card.back,
        newFront: card.front,
        newBack: formattedTexts[idx] || card.back || "",
      }));
      
      setFormattedCards(results);
      toast.success(`Đã xử lý xong ${deck.cards.length} thẻ.`);
    } catch (e: any) {
      toast.error("Lỗi khi gọi AI Formatting: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = async () => {
    if (!formattedCards || !selectedDeckId) return;
    
    const deck = store.getDeck(selectedDeckId);
    if (!deck) return;

    let changesCount = 0;
    formattedCards.forEach((fc) => {
      const cardRef = deck.cards.find(c => c.id === fc.id);
      if (cardRef && (cardRef.back !== fc.newBack || cardRef.front !== fc.newFront)) {
        cardRef.back = fc.newBack;
        cardRef.front = fc.newFront;
        changesCount++;
        
        const user = store.getCurrentUser();
        if (user) {
           OfflineSyncQueue.enqueueCardState(user.id, cardRef.id, {
               back: fc.newBack,
               front: fc.newFront
           });
        }
      }
    });

    if (changesCount > 0) {
       store.setDecksLocally(store.getDecks());
       if (typeof window !== "undefined") {
           window.dispatchEvent(new CustomEvent("henosis-data-synced"));
       }
       toast.success(`Đã lưu formatting mới cho ${changesCount} thẻ.`);
    } else {
       toast.info("Không có thay đổi nào cần lưu.");
    }
    
    setFormattedCards(null);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-xs font-black uppercase opacity-70 block tracking-wide">
          Tối ưu hóa định dạng Flashcard (Line Breaks)
        </h4>
        <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded">
          Chế độ hàng loạt (Study Set)
        </span>
      </div>
      
      <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div className="mb-4">
          <label className="text-xs font-bold uppercase opacity-70 block tracking-wide mb-2">
            CHỌN BỘ THẺ CẦN TỐI ƯU
          </label>
          <CustomDeckSelect
            decks={store.getDecks()}
            value={selectedDeckId}
            onChange={(val) => {
              setSelectedDeckId(val);
              setFormattedCards(null);
            }}
          />
        </div>
        
        {!formattedCards ? (
            <button
              onClick={handleFormat}
              disabled={isProcessing || !selectedDeckId}
              className="btn-3d px-6 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-55 text-white font-black rounded-xl cursor-pointer hover:shadow transition flex items-center justify-center gap-2 text-sm w-full"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {isProcessing ? "Đang phân tích..." : "Optimize Formatting"}
            </button>
        ) : (
            <div className="space-y-4">
                <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
                    {formattedCards.map((fc, i) => {
                        const isChanged = fc.oldBack !== fc.newBack || fc.oldFront !== fc.newFront;
                        return (
                            <div key={fc.id} className={cn("p-4 rounded-xl border text-sm", isChanged ? "border-blue-400 bg-blue-50 dark:bg-blue-900/10" : "border-zinc-200 dark:border-zinc-800")}>
                                <div className="font-bold mb-2">Thẻ {i + 1}: {fc.oldFront}</div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-xs opacity-50 font-bold mb-1">Cũ (Raw):</div>
                                        <div className="whitespace-pre-wrap opacity-70">{fc.oldBack}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs opacity-50 font-bold mb-1 text-blue-600 dark:text-blue-400">Mới (Formatted):</div>
                                        <div className="whitespace-pre-wrap">{fc.newBack}</div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
                
                <div className="flex gap-4">
                    <button
                        onClick={handleApply}
                        className="flex-1 btn-3d px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white font-black rounded-xl cursor-pointer hover:shadow transition flex items-center justify-center gap-2 text-sm active:scale-95"
                    >
                        <Save className="w-4 h-4" /> Xác nhận lưu
                    </button>
                    <button
                        onClick={() => setFormattedCards(null)}
                        className="btn-3d px-6 py-2.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-black rounded-xl cursor-pointer hover:shadow transition flex items-center justify-center gap-2 text-sm active:scale-95"
                    >
                        <XCircle className="w-4 h-4" /> Hủy
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
