from PIL import Image, ImageEnhance

def convert_blue_to_black(input_path, output_path):
    img = Image.open(input_path).convert("RGB")
    pixels = img.load()
    width, height = img.size

    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y]
            
            # A simple heuristic: if it's blue-ish or purple-ish, darken it.
            # Blue-ish: b > r and b > g
            # Purple-ish: r > g and b > g
            
            is_blue = b > r + 20 and b > g + 20
            is_purple = r > g + 20 and b > g + 20
            
            if is_blue or is_purple:
                # Darken significantly
                pixels[x, y] = (int(r * 0.1), int(g * 0.1), int(b * 0.1))
            else:
                # It's likely silver or white. 
                # Ensure it stays bright.
                pass

    # Save as high quality JPEG
    img.save(output_path, "JPEG", quality=95)

if __name__ == "__main__":
    input_file = "/Users/hkfiles/.gemini/antigravity/brain/4bf9a98a-7c66-4719-9926-c15392f6df82/play_store_icon_cinematic.jpg"
    output_file = "/Users/hkfiles/Desktop/play_store_icon_final_black.jpg"
    convert_blue_to_black(input_file, output_file)
    print(f"Final black version saved to {output_file}")
