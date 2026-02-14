import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { firestore } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";

export interface Friend {
  userId: string;
  nickname: string;
  profileImage: string | null;
}

export function useFriends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFriends([]);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      collection(firestore, "friends", user.uid, "users"),
      (snap) => {
        const list = snap.docs.map((d) => ({
          userId: d.id,
          nickname: d.data().nickname || "",
          profileImage: d.data().profileImage || null,
        }));
        setFriends(list);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to subscribe to friends:", err);
        setLoading(false);
      }
    );

    return unsub;
  }, [user]);

  return { friends, loading };
}
