import urllib.request
import json
from train_validator import (
    generate_chest_xray,
    generate_textbook_page,
    generate_blank_paper,
    generate_natural_photo_or_scene,
    generate_unrelated_medical_scan,
)

def test_endpoint(name, img, is_valid_expected):
    if img is not None:
        rgba = []
        for y in range(64):
            for x in range(64):
                v = int(img[y, x])
                rgba.extend([v, v, v, 255])
        payload = json.dumps({'rgba': rgba, 'width': 64, 'height': 64, 'fileSize': 40000}).encode('utf-8')
    else:
        payload = b'{"corrupt": true}'

    req = urllib.request.Request(
        'http://localhost:8080/api/scan',
        data=payload,
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            status = resp.status
            prob = data.get('probability', 0)
            passed = (status == 200) == is_valid_expected
            status_text = "PASS" if passed else "FAIL"
            print(f"[{name}] -> HTTP {status} (Expected: 200, P(X-ray)={prob:.4f}) -> {status_text}")
    except urllib.error.HTTPError as e:
        data = json.loads(e.read().decode())
        err = data.get('error', '')
        passed = (e.code == 400) and (not is_valid_expected)
        status_text = "PASS" if passed else "FAIL"
        print(f"[{name}] -> HTTP {e.code} (Expected: 400, Error='{err}') -> {status_text}")

if __name__ == '__main__':
    print("=== LIVE LOCALHOST BACKEND REGRESSION TEST (http://localhost:8080/api/scan) ===")
    test_endpoint("1. Textbook Page", generate_textbook_page(64), False)
    test_endpoint("2. Blank Paper", generate_blank_paper(64), False)
    test_endpoint("3. Photograph", generate_natural_photo_or_scene(64), False)
    test_endpoint("4. Unrelated Medical (MRI)", generate_unrelated_medical_scan(64), False)
    test_endpoint("5. Genuine Normal Chest X-ray", generate_chest_xray(64), True)
    test_endpoint("6. Corrupted Payload", None, False)
