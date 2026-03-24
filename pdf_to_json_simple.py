from pdf2image import convert_from_path
import pytesseract
import json

# 如果报错找不到 tesseract，就取消下面这行注释，并改路径
# pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

images = convert_from_path("part1.pdf")

result = []

for i, img in enumerate(images):
    text = pytesseract.image_to_string(img, lang="jpn+chi_sim")
    result.append({
        "page": i + 1,
        "text": text
    })

with open("output.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print("完成！生成 output.json")
