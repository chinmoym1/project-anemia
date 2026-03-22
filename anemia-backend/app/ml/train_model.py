import os
import cv2
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, r2_score
from PIL import Image
import pickle

# --- FOLDER SETUP ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "dataset") 
MODEL_OUTPUT = os.path.join(BASE_DIR, "anemia_model.pkl")

def extract_masked_features(image_path, mask_path):
    img = cv2.imread(image_path)
    
    # 🚀 FIX 1: Use PIL to load the PNG mask. This completely silences the libpng CRC warning!
    try:
        mask_pil = Image.open(mask_path).convert('L')
        mask_img = np.array(mask_pil)
    except Exception:
        return None
    
    if img is None or mask_img is None:
        return None
        
    if img.shape[:2] != mask_img.shape[:2]:
        mask_img = cv2.resize(mask_img, (img.shape[1], img.shape[0]))
        
    mask_bool = mask_img > 0
    if mask_bool.sum() < 100:
        return None 

    # --- CIELab Features ---
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    l_channel = lab[:, :, 0][mask_bool]
    a_channel = lab[:, :, 1][mask_bool]
    b_channel = lab[:, :, 2][mask_bool]

    L = l_channel * 100.0 / 255.0
    a = a_channel - 128.0
    b = b_channel - 128.0

    # 🚀 FIX 2: Use MEDIAN instead of MEAN to completely ignore white LED glare!
    a_median = float(np.median(a))
    # Use the 75th percentile of 'a' to find the reddest healthy tissue
    erythema_index = float(np.percentile(a, 75)) 

    # --- HSV Features ---
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
    h = hsv[:, :, 0][mask_bool]
    s = hsv[:, :, 1][mask_bool]
    v = hsv[:, :, 2][mask_bool]

    return [
        a_median,                    # Was mean, now median
        float(np.median(a) / 128.0), # Was mean, now median  
        erythema_index,              # Looks at 75th percentile
        float(np.median(L)),         
        float(np.median(b)),         
        float(np.std(a)),            
        float(np.std(b)),            
        float(np.median(h)),         
        float(np.median(s) / 255.0), 
        float(np.median(v) / 255.0), 
        float(np.std(s) / 255.0)     
    ]

def process_country_folder(country_path, excel_filename):
    records = []
    excel_path = os.path.join(country_path, excel_filename)
    
    if not os.path.exists(excel_path) and excel_filename.endswith('.xlsx'):
        fallback = excel_path.replace('.xlsx', '.xls')
        if os.path.exists(fallback):
            excel_path = fallback
            
    if not os.path.exists(excel_path):
        return records
        
    print(f"📄 Reading {excel_path}...")
    try:
        df = pd.read_excel(excel_path)
    except Exception as e:
        return records
        
    number_col = next((col for col in df.columns if 'number' in str(col).lower()), None)
    hb_col = next((col for col in df.columns if 'hb' in str(col).lower() or 'hgb' in str(col).lower()), None)
    
    if not number_col or not hb_col:
        return records
        
    for index, row in df.iterrows():
        patient_num = str(row[number_col]).strip()
        if patient_num.endswith('.0'): 
            patient_num = patient_num[:-2]
            
        hb_raw = row[hb_col]
        
        if pd.isna(hb_raw) or str(hb_raw).strip() == '':
            continue
            
        hb_clean = str(hb_raw).replace(',', '.').strip()
        try:
            hb_level = float(hb_clean)
        except ValueError:
            continue
            
        # Try both folder naming formats (e.g., "1" and "person 1")
        folder_option_1 = os.path.join(country_path, patient_num)
        folder_option_2 = os.path.join(country_path, f"person {patient_num}")
        
        patient_folder = None
        if os.path.exists(folder_option_1):
            patient_folder = folder_option_1
        elif os.path.exists(folder_option_2):
            patient_folder = folder_option_2
            
        if not patient_folder:
            continue
            
        jpg_image = None
        mask_image = None
        
        # Smart file matching
        for file in os.listdir(patient_folder):
            file_lower = file.lower()
            
            # Find the JPG
            if file_lower.endswith(('.jpg', '.jpeg')):
                jpg_image = os.path.join(patient_folder, file)
                
            # Find the Mask (must contain 'palpebral', end in '.png', and NOT contain 'forniceal')
            elif 'palpebral' in file_lower and file_lower.endswith('.png') and 'forniceal' not in file_lower:
                mask_image = os.path.join(patient_folder, file)
                
        if jpg_image and mask_image:
            records.append((jpg_image, mask_image, hb_level))
        elif jpg_image and not mask_image:
            print(f"   ⚠️ Warning: Found eye image for patient {patient_num}, but missing palpebral mask! Skipping.")
            
    return records

def train():
    print("🚀 Starting High-Precision ML Training (Eyes-Defy-Anemia)...")
    
    italy_dir = os.path.join(DATASET_DIR, "Italy")
    india_dir = os.path.join(DATASET_DIR, "India")
    
    image_records = []
    if os.path.exists(italy_dir):
        image_records.extend(process_country_folder(italy_dir, "Italy.xlsx"))
    if os.path.exists(india_dir):
        image_records.extend(process_country_folder(india_dir, "India.xlsx"))
        
    if len(image_records) == 0:
        print("❌ ERROR: No images successfully mapped. Check folder structure.")
        return
        
    print(f"📊 Successfully loaded {len(image_records)} patient records WITH medical masks.")

    features_list = []
    labels_list = []

    print("🔬 Applying Medical Masks & Extracting Features...")
    for img_path, mask_path, hb_level in image_records:
        feat = extract_masked_features(img_path, mask_path)
        if feat is not None:
            features_list.append(feat)
            labels_list.append(hb_level)
            
    X = np.array(features_list)
    y = np.array(labels_list)

    if len(X) == 0:
        print("❌ ERROR: Could not extract features.")
        return

    # Train-Test Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print("🧠 Training ML Pipeline (StandardScaler + Robust Random Forest)...")
    
    print("🧠 Training ML Pipeline (StandardScaler + Gradient Boosting)...")
    
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("model", GradientBoostingRegressor(
            n_estimators=250,        # Number of boosting stages
            learning_rate=0.05,      # Learn slowly and carefully
            max_depth=4,             # Keep individual trees simple
            min_samples_leaf=3,      # Prevent memorizing outliers
            subsample=0.8,           # Use 80% of data per tree (prevents overfitting)
            random_state=42
        ))
    ])
    
    cv_scores = cross_val_score(pipeline, X, y, cv=5, scoring='neg_mean_absolute_error')
    print(f"🔄 5-Fold Cross-Validation MAE: {-cv_scores.mean():.2f} g/dL")

    pipeline.fit(X_train, y_train)

    predictions = pipeline.predict(X_test)
    mae = mean_absolute_error(y_test, predictions)
    r2 = r2_score(y_test, predictions)
    
    print("\n✅ --- TRAINING COMPLETE ---")
    print(f"📉 Test Set Mean Absolute Error: {mae:.2f} g/dL")
    print(f"🎯 Test Set R-Squared: {r2:.2f}")

    with open(MODEL_OUTPUT, 'wb') as f:
        pickle.dump(pipeline, f)
    print(f"💾 High-Precision Model saved to: {MODEL_OUTPUT}")

if __name__ == "__main__":
    train()