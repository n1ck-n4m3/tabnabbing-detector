#!/usr/bin/env python3
"""
Create beautiful Ragdoll cat icon with letter T
"""
try:
    from PIL import Image, ImageDraw, ImageFont
    import os
    
    def create_cat_icon(size):
        # Create image with gradient background (pink to white)
        img = Image.new('RGB', (size, size), color='#FFB6C1')
        draw = ImageDraw.Draw(img)
        
        # Draw gradient background (simplified)
        for i in range(size):
            ratio = i / size
            r = int(255 * (1 - ratio * 0.3))
            g = int(182 * (1 - ratio * 0.3))
            b = int(193 * (1 - ratio * 0.3))
            draw.rectangle([(0, i), (size, i+1)], fill=(r, g, b))
        
        # Draw cat ears (two triangles at top)
        ear_size = size // 4
        # Left ear
        draw.polygon([
            (size * 3 // 8, size // 4),
            (size * 5 // 16, size // 8),
            (size * 7 // 16, size // 8)
        ], fill='#8B4513')
        # Right ear
        draw.polygon([
            (size * 5 // 8, size // 4),
            (size * 9 // 16, size // 8),
            (size * 11 // 16, size // 8)
        ], fill='#8B4513')
        
        # Draw cat face (circle)
        face_radius = size // 3
        face_center = (size // 2, size * 3 // 8)
        bbox = (
            face_center[0] - face_radius,
            face_center[1] - face_radius,
            face_center[0] + face_radius,
            face_center[1] + face_radius
        )
        draw.ellipse(bbox, fill='#FFE4E1', outline='#FFB6C1', width=2)
        
        # Draw cat eyes (two small circles)
        eye_size = size // 12
        # Left eye
        left_eye = (size * 7 // 16, size * 3 // 8)
        eye_bbox = (
            left_eye[0] - eye_size,
            left_eye[1] - eye_size,
            left_eye[0] + eye_size,
            left_eye[1] + eye_size
        )
        draw.ellipse(eye_bbox, fill='#8B4513')
        
        # Right eye
        right_eye = (size * 9 // 16, size * 3 // 8)
        eye_bbox = (
            right_eye[0] - eye_size,
            right_eye[1] - eye_size,
            right_eye[0] + eye_size,
            right_eye[1] + eye_size
        )
        draw.ellipse(eye_bbox, fill='#8B4513')
        
        # Draw cat nose (small triangle)
        nose_points = [
            (size // 2, size * 7 // 16),
            (size * 15 // 32, size * 9 // 16),
            (size * 17 // 32, size * 9 // 16)
        ]
        draw.polygon(nose_points, fill='#FF69B4')
        
        # Draw letter T with shadow
        font_size = size * 3 // 5
        try:
            # Try to use system font
            if os.path.exists('/System/Library/Fonts/Supplemental/Arial Bold.ttf'):
                font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', font_size)
            elif os.path.exists('/System/Library/Fonts/Helvetica.ttc'):
                font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', font_size)
            else:
                font = ImageFont.load_default()
        except:
            font = ImageFont.load_default()
        
        # Draw shadow
        text = 'T'
        text_bbox = draw.textbbox((0, 0), text, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]
        text_pos = (
            (size - text_width) // 2 + 1,
            size * 3 // 4 - text_height // 2 + 1
        )
        draw.text(text_pos, text, fill='rgba(0,0,0,100)', font=font)
        
        # Draw main text
        text_pos = (
            (size - text_width) // 2,
            size * 3 // 4 - text_height // 2
        )
        draw.text(text_pos, text, fill='#FFFFFF', font=font)
        
        return img
    
    # Create icons for all sizes
    for size in [16, 48, 128]:
        icon = create_cat_icon(size)
        icon.save(f'icon{size}.png')
        print(f'Created icon{size}.png ({size}x{size})')
    
    print("All icons created successfully!")
    
except ImportError:
    print("PIL/Pillow not installed. Installing...")
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    print("Please run the script again.")
except Exception as e:
    print(f"Error: {e}")
    print("Falling back to simple icon creation...")
    # Fallback: create simple icons using ImageMagick
    import subprocess
    for size in [16, 48, 128]:
        subprocess.run([
            'magick', '-size', f'{size}x{size}',
            'gradient:#FFB6C1-#FFFFFF',
            '-fill', '#FFFFFF',
            '-pointsize', str(size * 3 // 5),
            '-gravity', 'center',
            '-annotate', '+0+0', 'T',
            f'icon{size}.png'
        ])
        print(f'Created simple icon{size}.png')

