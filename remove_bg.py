from rembg import remove
from PIL import Image

def process(inp, outp):
    try:
        input_image = Image.open(inp)
        output_image = remove(input_image)
        output_image.save(outp)
        print(f"Saved {outp}")
    except Exception as e:
        print(e)

process("client/public/img/guitar.png", "client/public/img/guitar-trans.png")
process("client/public/img/drum.png", "client/public/img/drum-trans.png")
process("client/public/img/sax.png", "client/public/img/sax-trans.png")
process("client/public/img/violin.png", "client/public/img/violin-trans.png")
