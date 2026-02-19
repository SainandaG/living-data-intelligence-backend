
try:
    with open('verify_output.txt', 'r', encoding='utf-16') as f:
        print(f.read())
except Exception as e:
    print(f"Failed to read utf-16: {e}")
    try:
        with open('verify_output.txt', 'r', encoding='utf-8') as f:
            print(f.read())
    except Exception as e2:
        print(f"Failed to read utf-8: {e2}")
