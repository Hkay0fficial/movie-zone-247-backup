from PIL import Image

def create_header_image(logo_path, output_path):
    # Target size
    target_w = 4096
    target_h = 2304
    
    # Create black canvas
    canvas = Image.new("RGB", (target_w, target_h), (0, 0, 0))
    
    # Load and potentially resize logo
    logo = Image.open(logo_path).convert("RGB")
    logo_w, logo_h = logo.size
    
    # Let's make it 2000px high in the center to make it "near" and prominent.
    scale = 2000 / logo_h
    new_logo_w = int(logo_w * scale)
    new_logo_h = 2000
    logo = logo.resize((new_logo_w, new_logo_h), Image.Resampling.LANCZOS)
    
    # Center the logo
    x = (target_w - new_logo_w) // 2
    y = (target_h - new_logo_h) // 2
    canvas.paste(logo, (x, y))
    
    # Save as JPEG with adjusted quality to stay under 1MB
    # For 4096x2304, quality 85 is usually plenty and should be small due to black space.
    canvas.save(output_path, "JPEG", quality=85, optimize=True)

if __name__ == "__main__":
    logo_file = "/Users/hkfiles/.gemini/antigravity/brain/4bf9a98a-7c66-4719-9926-c15392f6df82/media__1778088486358.jpg"
    output_file = "/Users/hkfiles/Desktop/play_store_header_image.jpg"
    create_header_image(logo_file, output_file)
    print(f"Header image saved to {output_file}")
