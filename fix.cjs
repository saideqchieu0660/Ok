const fs = require('fs');
let text = fs.readFileSync('src/pages/StudentDashboard.tsx', 'utf8');

const regex = /setActiveTab\("all_sets"\);\s*};\s*return prev;\s*\}\);\s*\}, 3000\);\s*\} catch \(e\) \{\s*console\.error\("Failed to sync sets in real-time:", e\);\s*setIsInitialLoading\(false\);\s*\}\s*return \(\) => \{\s*if \(unsubDecksRef\.current\) \{\s*unsubDecksRef\.current\(\);\s*unsubDecksRef\.current = null;\s*\}\s*FirebaseListenerManager\.remove\("StudentDashboard_decks"\);\s*\};\s*\}, \[user\?\.id\]\);/s;

const replacement = `setActiveTab("all_sets");
  };

  const unsubDecksRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!user) return;
    if (unsubDecksRef.current) unsubDecksRef.current();

    try {
      const q = query(collection(db, "decks"), where("ownerId", "==", user.id));
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const list = [];
          snapshot.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() });
          });
          setRawDecks(list);
        },
        (err) => {
          console.error("Decks sync error:", err);
        }
      );
      unsubDecksRef.current = unsub;
      FirebaseListenerManager.add("StudentDashboard_decks", unsub);
    } catch (e) {
      console.error("Failed to sync sets in real-time:", e);
    }

    return () => {
      if (unsubDecksRef.current) {
        unsubDecksRef.current();
        unsubDecksRef.current = null;
      }
      FirebaseListenerManager.remove("StudentDashboard_decks");
    };
  }, [user?.id]);`;

if (regex.test(text)) {
  text = text.replace(regex, replacement);
  fs.writeFileSync('src/pages/StudentDashboard.tsx', text);
  console.log("Replaced successfully with regex.");
} else {
  console.log("Regex not found.");
}
