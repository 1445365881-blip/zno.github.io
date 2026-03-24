import pdfplumber
import re
import json

PDF_FILE = "book.pdf"
OUTPUT_FILE = "words.js"

def parse_line(line):
    line = re.sub(r"\s+", " ", line).strip()
    parts = line.split(" ")

    if len(parts) < 4:
        return None

    level = parts[-1]
    if level not in ["N1", "N2", "N3", "N4", "N5"]:
        return None

    kana = parts[1]
    kanji = parts[2] if len(parts) > 2 else ""
    meaning = parts[3]

    return {
        "level": level.lower(),
        "kana": kana,
        "kanji": "" if kanji == kana else kanji,
        "meaning": meaning,
        "exampleJa": "",
        "exampleZh": ""
    }

def main():
    all_words = {
        "n2": [],
        
    }

    with pdfplumber.open(PDF_FILE) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            text = page.extract_text()
            if not text:
                print(f"第 {page_num} 页没有提取到文字")
                continue

            lines = text.split("\n")
            print(f"第 {page_num} 页读取到 {len(lines)} 行")

            for line in lines:
                item = parse_line(line)
                if item:
                    level = item.pop("level")
                    if level in all_words:
                        all_words[level].append(item)

    output = "const books = " + json.dumps(all_words, ensure_ascii=False, indent=2) + ";"

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(output)

    print("✅ 已生成 words.js")
    print("N2 数量：", len(all_words["n2"]))
    

if __name__ == "__main__":
    main()
    