from PIL import Image
import os

def remove_background_and_save():
    input_path = "/Users/ousin/Library/CloudStorage/Dropbox/屏幕截图/Screenshot 2026-01-12 at 20.10.46.png"
    output_dir = "/Users/ousin/Projects/browser-extension/files"
    
    print(f"Processing: {input_path}")
    
    try:
        img = Image.open(input_path)
        img = img.convert("RGBA")
        
        datas = img.getdata()
        
        newData = []
        for item in datas:
            # Threshold for white background
            # The screenshot likely has a very light/white background
            if item[0] > 240 and item[1] > 240 and item[2] > 240:
                newData.append((255, 255, 255, 0))
            else:
                newData.append(item)
        
        img.putdata(newData)
        
        # Save High Res version
        img.save(os.path.join(output_dir, "icon_high_res.png"), "PNG")
        
        # Save Standard Sizes with High Quality Resampling
        # 128x128
        icon128 = img.resize((128, 128), Image.Resampling.LANCZOS)
        icon128.save(os.path.join(output_dir, "icon128.png"), "PNG")
        
        # 48x48
        icon48 = img.resize((48, 48), Image.Resampling.LANCZOS)
        icon48.save(os.path.join(output_dir, "icon48.png"), "PNG")
        
        # 16x16
        icon16 = img.resize((16, 16), Image.Resampling.LANCZOS)
        icon16.save(os.path.join(output_dir, "icon16.png"), "PNG")
        
        print("Successfully removed background and saved icons.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    remove_background_and_save()
