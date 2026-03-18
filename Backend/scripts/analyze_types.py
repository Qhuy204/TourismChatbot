
import json
from collections import Counter

def analyze_types(path, limit=1000):
    types = Counter()
    with open(path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            if i >= limit: break
            try:
                item = json.loads(line)
                for vqa in item.get("vqa_pairs", []):
                    if vqa.get("answer_type") == "Geographic info - Type":
                        ans = vqa.get("answers", [""])[0]
                        if ans:
                            # Split by comma if multiple types
                            for t in ans.split(","):
                                types[t.strip()] += 1
            except:
                continue
    
    print("--- Top Entity Types ---")
    for t, count in types.most_common(50):
        print(f"{t}: {count}")

if __name__ == "__main__":
    analyze_types("/home/qhuy/TourismChatbot/TourismChatbot/Data/vqa_dataset.jsonl", limit=10000)
