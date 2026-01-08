import google.generativeai as genai

# 1. Cấu hình API Key
genai.configure(api_key="API")

# 2. Lấy danh sách models
print("Danh sách các model khả dụng:")
for m in genai.list_models():
    # Thường chúng ta chỉ quan tâm đến các model có tính năng 'generateContent'
    if 'generateContent' in m.supported_generation_methods:
        print(f"- Tên: {m.name}")
        print(f"  Mô tả: {m.description}")
        print(f"  Input Token Limit: {m.input_token_limit}")
        print(f"  Output Token Limit: {m.output_token_limit}")
        print("-" * 20)