import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import json
import os

np.random.seed(42)

def generate_chest_xray(size=64):
    """
    Generate synthetic frontal chest X-ray profile with realistic anatomy:
    - Dark outer collimation / air edges (especially corners)
    - Central radiopaque spine and mediastinum (brighter)
    - Left and right radiolucent lung fields (darker)
    - Cardiac silhouette (heart shadow in left lower thorax)
    - Curved diaphragmatic dome at bottom
    - Rib cage / soft tissue gradients
    - Contrast, exposure, noise and anatomical variations
    - Pediatric vs adult lung proportions
    - Pneumonia infiltrates (bright patches in lungs) vs Normal lungs
    """
    img = np.zeros((size, size), dtype=np.float32)
    y, x = np.mgrid[0:size, 0:size]
    cx = size / 2.0 + np.random.uniform(-3, 3)
    cy = size / 2.0 + np.random.uniform(-3, 3)

    # Base thoracic soft tissue contour (oval)
    rx = size * np.random.uniform(0.36, 0.46)
    ry = size * np.random.uniform(0.40, 0.48)
    thorax = np.exp(-(((x - cx)**2) / (2 * rx**2) + ((y - cy)**2) / (2 * ry**2)))
    base_intensity = np.random.uniform(80, 160)
    img += thorax * base_intensity

    # Central mediastinum / spine (vertical bright column)
    spine_w = size * np.random.uniform(0.12, 0.18)
    spine = np.exp(-((x - cx)**2) / (2 * (spine_w / 2)**2))
    img += spine * np.random.uniform(30, 80)

    # Heart silhouette (left-shifted lower cardiac shadow)
    heart_cx = cx + np.random.uniform(3, 9)
    heart_cy = cy + np.random.uniform(4, 12)
    heart_r = size * np.random.uniform(0.14, 0.22)
    heart = np.exp(-(((x - heart_cx)**2) / (2 * heart_r**2) + ((y - heart_cy)**2) / (2 * heart_r**2)))
    img += heart * np.random.uniform(40, 90)

    # Left and Right Lung Fields (darker radiolucent cavities)
    lung_y0 = cy - size * np.random.uniform(0.05, 0.15)
    lung_ry = size * np.random.uniform(0.18, 0.28)
    lung_rx = size * np.random.uniform(0.12, 0.18)

    # Left lung (patient's right, screen left)
    ll_x = cx - size * np.random.uniform(0.20, 0.28)
    ll = np.exp(-(((x - ll_x)**2) / (2 * lung_rx**2) + ((y - lung_y0)**2) / (2 * lung_ry**2)))

    # Right lung (patient's left, screen right)
    rl_x = cx + size * np.random.uniform(0.20, 0.28)
    rl = np.exp(-(((x - rl_x)**2) / (2 * lung_rx**2) + ((y - lung_y0)**2) / (2 * lung_ry**2)))

    # Radiographic lung darkness
    lung_depth = np.random.uniform(45, 95)
    img -= (ll + rl) * lung_depth

    # Optional pneumonia consolidations in lungs (patchy brightness)
    if np.random.random() > 0.4:
        p_cx = ll_x if np.random.random() > 0.5 else rl_x
        p_cx += np.random.uniform(-4, 4)
        p_cy = lung_y0 + np.random.uniform(-4, 8)
        p_r = size * np.random.uniform(0.06, 0.14)
        infiltrate = np.exp(-(((x - p_cx)**2) / (2 * p_r**2) + ((y - p_cy)**2) / (2 * p_r**2)))
        img += infiltrate * np.random.uniform(25, 60)

    # Diaphragm cut-off at bottom
    diaphragm_y = size * np.random.uniform(0.70, 0.85)
    abdomen = 1.0 / (1.0 + np.exp(-(y - diaphragm_y) / 2.5))
    img += abdomen * np.random.uniform(20, 70)

    # Dark collimator corners / air borders
    corner_mask = 1.0 - np.exp(-(((x - size/2)**2) / (2 * (size * 0.42)**2) + ((y - size/2)**2) / (2 * (size * 0.42)**2)))
    img *= (1.0 - 0.75 * corner_mask)

    # Exposure & contrast variation
    exposure = np.random.uniform(0.65, 1.35)
    img = img * exposure + np.random.normal(0, np.random.uniform(2, 6), (size, size))
    img = np.clip(img, 0, 255)
    return img

def generate_textbook_page(size=64):
    """
    Generate realistic textbook page / printed document:
    - Supports bright scans (220-250) AND ambient phone photos (100-190)
    - Dark text lines in rows with spacing
    - Margins around borders
    - Headers, paragraphs, columns, diagrams
    """
    # Lighting condition: bright scanner or dim room camera photo
    base_paper = np.random.choice([
        np.random.uniform(220, 250), # bright scan
        np.random.uniform(160, 215), # well-lit paper
        np.random.uniform(110, 160), # dim ambient indoor phone photo
    ])
    img = np.full((size, size), base_paper, dtype=np.float32)

    # Uneven paper lighting gradient (phone camera shadow)
    grad_x = np.random.uniform(-0.3, 0.3)
    grad_y = np.random.uniform(-0.3, 0.3)
    y_idx, x_idx = np.mgrid[0:size, 0:size]
    img += (x_idx - size/2) * grad_x + (y_idx - size/2) * grad_y
    img += np.random.normal(0, 2.5, (size, size))

    # Margins (top, bottom, left, right)
    margin_top = int(size * np.random.uniform(0.08, 0.18))
    margin_bot = int(size * np.random.uniform(0.82, 0.92))
    margin_left = int(size * np.random.uniform(0.08, 0.16))
    margin_right = int(size * np.random.uniform(0.84, 0.92))

    # Text lines
    line_h = np.random.choice([2, 3, 4])
    line_spacing = np.random.choice([2, 3, 4, 5])
    two_column = np.random.random() > 0.5
    ink_contrast = np.random.uniform(60, min(180, base_paper - 15))

    curr_y = margin_top
    while curr_y < margin_bot - line_h:
        if np.random.random() < 0.15:
            curr_y += line_spacing * 2
            continue

        if two_column:
            col1_end = int(size * 0.46)
            col2_start = int(size * 0.54)
            for x in range(margin_left, col1_end):
                if np.random.random() > 0.20:
                    img[curr_y:curr_y+line_h, x] -= ink_contrast * np.random.uniform(0.7, 1.0)
            for x in range(col2_start, margin_right):
                if np.random.random() > 0.20:
                    img[curr_y:curr_y+line_h, x] -= ink_contrast * np.random.uniform(0.7, 1.0)
        else:
            line_end = margin_right if np.random.random() > 0.2 else int(margin_right * np.random.uniform(0.5, 0.85))
            for x in range(margin_left, line_end):
                if np.random.random() > 0.20:
                    img[curr_y:curr_y+line_h, x] -= ink_contrast * np.random.uniform(0.7, 1.0)

        curr_y += line_h + line_spacing

    img = np.clip(img, 0, 255)
    return img

def generate_unrelated_medical_scan(size=64):
    """
    Generate non-chest medical scans (Brain MRI / head CT / abdominal slice):
    - Circular/oval skull or head ring
    - Homogeneous brain parenchyma or abdominal soft tissue
    - Completely lacks bilateral radiolucent lung fields or vertical mediastinal column
    """
    img = np.zeros((size, size), dtype=np.float32)
    cx, cy = size / 2.0 + np.random.uniform(-2, 2), size / 2.0 + np.random.uniform(-2, 2)
    y, x = np.mgrid[0:size, 0:size]
    dist = np.sqrt((x - cx)**2 + (y - cy)**2)
    r_skull = size * np.random.uniform(0.32, 0.42)
    skull_thickness = size * np.random.uniform(0.04, 0.07)

    # Brain tissue inside
    inside = dist < r_skull
    img[inside] = np.random.uniform(90, 140) + np.random.normal(0, 8, img[inside].shape)

    # Skull ring (bright bone)
    bone = (dist >= (r_skull - skull_thickness)) & (dist <= r_skull)
    img[bone] = np.random.uniform(180, 230)

    # Optional ventricles / dark fluid spaces
    v_mask = ((x - cx)**2 / (size*0.06)**2 + (y - cy)**2 / (size*0.14)**2) < 1.0
    img[v_mask] = np.random.uniform(20, 50)

    img = np.clip(img, 0, 255)
    return img

def generate_blank_paper(size=64):
    """
    Generate blank sheet of paper:
    - Uniform or slight gradient
    - No lung cavities or bone anatomy
    """
    paper_val = np.random.uniform(120, 250)
    img = np.full((size, size), paper_val, dtype=np.float32)
    y_idx, x_idx = np.mgrid[0:size, 0:size]
    img += (x_idx - size/2) * np.random.uniform(-0.2, 0.2) + (y_idx - size/2) * np.random.uniform(-0.2, 0.2)
    img += np.random.normal(0, 3, (size, size))
    return np.clip(img, 0, 255)

def generate_natural_photo_or_scene(size=64):
    """
    Generate natural photo / selfie / landscape / UI screenshot:
    """
    kind = np.random.choice(["portrait", "landscape", "ui_screenshot", "gradient"])
    img = np.zeros((size, size), dtype=np.float32)

    if kind == "portrait":
        # Face in center, hair, clothes
        bg = np.random.uniform(50, 190)
        img[:] = bg
        y, x = np.mgrid[0:size, 0:size]
        face = np.exp(-(((x - size/2)**2)/(2*(size*0.25)**2) + ((y - size*0.4)**2)/(2*(size*0.3)**2)))
        img = img * (1 - face) + face * np.random.uniform(160, 230)
        img += np.random.normal(0, 5, (size, size))
    elif kind == "landscape":
        split = int(size * np.random.uniform(0.4, 0.7))
        img[:split, :] = np.random.uniform(150, 240)
        img[split:, :] = np.random.uniform(40, 110)
        img += np.random.normal(0, 8, (size, size))
    elif kind == "ui_screenshot":
        img[:] = np.random.uniform(220, 245)
        img[:int(size*0.15), :] = np.random.uniform(30, 80)
        card_y = int(size*0.3)
        img[card_y:card_y+int(size*0.4), int(size*0.1):int(size*0.9)] = np.random.uniform(240, 255)
    else:
        y, x = np.mgrid[0:size, 0:size]
        img = (x + y) * (255.0 / (2 * size)) + np.random.normal(0, 15, (size, size))

    return np.clip(img, 0, 255)

def extract_features(img, colorful_fraction=0.0):
    """
    Extract 73 discriminative features:
    - 64 block features from 8x8 grid (spatial anatomical template)
    - Corner intensity ratio (mean of four 8x8 corners / 255.0)
    - White pixel ratio (> 215)
    - Dark pixel ratio (< 45)
    - Mean brightness / 255.0
    - Stddev brightness / 255.0
    - Bilateral symmetry correlation
    - Central column to lateral lung ratio
    - Row-wise gradient variance (text line oscillation)
    - Colorful fraction
    """
    size = img.shape[0]
    total_pixels = size * size

    # 1. 8x8 grid features (64)
    grid_size = 8
    block_h = size // grid_size
    grid = np.zeros(64, dtype=np.float32)
    for gy in range(grid_size):
        for gx in range(grid_size):
            patch = img[gy*block_h:(gy+1)*block_h, gx*block_h:(gx+1)*block_h]
            grid[gy * grid_size + gx] = np.mean(patch) / 255.0

    # 2. Four corners (8x8 patch at each corner)
    corner_tl = img[0:block_h, 0:block_h]
    corner_tr = img[0:block_h, size-block_h:size]
    corner_bl = img[size-block_h:size, 0:block_h]
    corner_br = img[size-block_h:size, size-block_h:size]
    corner_mean = (np.mean(corner_tl) + np.mean(corner_tr) + np.mean(corner_bl) + np.mean(corner_br)) / (4.0 * 255.0)

    # 3. White / Dark pixel ratios
    white_ratio = np.sum(img > 215) / float(total_pixels)
    dark_ratio = np.sum(img < 45) / float(total_pixels)

    # 4. Global statistics
    mean_b = np.mean(img) / 255.0
    std_b = np.std(img) / 255.0

    # 5. Bilateral symmetry (left half vs flipped right half)
    half_w = size // 2
    left_half = img[:, :half_w].flatten()
    right_half = np.fliplr(img[:, half_w:]).flatten()
    std_l = np.std(left_half)
    std_r = np.std(right_half)
    if std_l > 1e-4 and std_r > 1e-4:
        symmetry = float(np.corrcoef(left_half, right_half)[0, 1])
    else:
        symmetry = 0.0

    # 6. Central mediastinum vs lateral lung zones
    c_x1, c_x2 = int(size * 0.40), int(size * 0.60)
    l_x1, l_x2 = int(size * 0.15), int(size * 0.35)
    r_x1, r_x2 = int(size * 0.65), int(size * 0.85)
    y1, y2 = int(size * 0.25), int(size * 0.65)
    center_val = np.mean(img[y1:y2, c_x1:c_x2])
    lateral_val = (np.mean(img[y1:y2, l_x1:l_x2]) + np.mean(img[y1:y2, r_x1:r_x2])) / 2.0
    center_lateral_ratio = float(center_val / max(1.0, lateral_val))

    # 7. Row gradient variance (textbook lines have periodic row changes)
    row_sums = np.mean(img, axis=1)
    row_diffs = np.diff(row_sums)
    row_var = float(np.var(row_diffs) / (255.0**2))

    features = np.concatenate([
        grid,
        [corner_mean, white_ratio, dark_ratio, mean_b, std_b, symmetry, center_lateral_ratio, row_var, colorful_fraction]
    ])
    return features

def main():
    print("Generating comprehensive multi-condition dataset...")
    n_pos = 1600
    n_neg_book = 800
    n_neg_blank = 300
    n_neg_photo = 600
    n_neg_medical = 500

    X_list = []
    y_list = []

    # Positive: Frontal Chest X-rays
    for _ in range(n_pos):
        img = generate_chest_xray(size=64)
        feat = extract_features(img, colorful_fraction=0.0)
        X_list.append(feat)
        y_list.append(1)

    # Negative: Textbook pages (both bright scans and ambient phone photos)
    for _ in range(n_neg_book):
        img = generate_textbook_page(size=64)
        feat = extract_features(img, colorful_fraction=0.0)
        X_list.append(feat)
        y_list.append(0)

    # Negative: Blank sheets of paper
    for _ in range(n_neg_blank):
        img = generate_blank_paper(size=64)
        feat = extract_features(img, colorful_fraction=0.0)
        X_list.append(feat)
        y_list.append(0)

    # Negative: Unrelated medical scans (Brain MRI, head CT, ultrasound)
    for _ in range(n_neg_medical):
        img = generate_unrelated_medical_scan(size=64)
        feat = extract_features(img, colorful_fraction=0.0)
        X_list.append(feat)
        y_list.append(0)

    # Negative: Photos, selfies, screenshots, scenes
    for _ in range(n_neg_photo):
        img = generate_natural_photo_or_scene(size=64)
        color = np.random.uniform(0.12, 0.60) if np.random.random() > 0.3 else 0.0
        feat = extract_features(img, colorful_fraction=color)
        X_list.append(feat)
        y_list.append(0)

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.int32)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)

    print(f"Dataset: {len(X)} samples, {X.shape[1]} features")
    print(f"Train size: {len(X_train)}, Test size: {len(X_test)}")

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    clf = LogisticRegression(C=1.0, max_iter=1000, random_state=42)
    clf.fit(X_train_s, y_train)

    preds = clf.predict(X_test_s)
    acc = accuracy_score(y_test, preds)
    print(f"\nTest Accuracy: {acc * 100:.2f}%")
    print(classification_report(y_test, preds, target_names=["Non-Xray (Books/Paper/Photos)", "Chest X-Ray"]))

    # Test textbook pages across all lighting
    book_tests = [generate_textbook_page(size=64) for _ in range(250)]
    book_feats = scaler.transform(np.array([extract_features(b, 0.0) for b in book_tests]))
    book_probs = clf.predict_proba(book_feats)[:, 1]
    print(f"Textbook pages across all lighting: Max P(Xray) = {np.max(book_probs):.4f}, Mean P(Xray) = {np.mean(book_probs):.4f}")

    # Test blank paper
    blank_tests = [generate_blank_paper(size=64) for _ in range(100)]
    blank_feats = scaler.transform(np.array([extract_features(b, 0.0) for b in blank_tests]))
    blank_probs = clf.predict_proba(blank_feats)[:, 1]
    print(f"Blank paper sheets: Max P(Xray) = {np.max(blank_probs):.4f}, Mean P(Xray) = {np.mean(blank_probs):.4f}")

    # Export model to JSON
    export_data = {
        "model_id": "xray-validator-v2",
        "feature_count": int(X.shape[1]),
        "weights": [float(w) for w in clf.coef_[0]],
        "bias": float(clf.intercept_[0]),
        "scaler_mean": [float(m) for m in scaler.mean_],
        "scaler_scale": [float(s) for s in scaler.scale_],
        "threshold": 0.50
    }

    out_path = os.path.join("src", "lib", "classifier", "xray-validator-weights.json")
    with open(out_path, "w") as f:
        json.dump(export_data, f, indent=2)

    print(f"\nModel exported successfully to {out_path} ({os.path.getsize(out_path)} bytes)")

if __name__ == "__main__":
    main()
