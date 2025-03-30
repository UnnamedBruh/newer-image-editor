// This is an unfinished decoder I am working on.

const METADATA_ONLY = 0;
const METADATA_AND_IMAGE = 1;
const DEBUGGING = 2;

function readUInt32LE(array, offset) {
    return (array[offset]) | (array[offset + 1] << 8) | (array[offset + 2] << 16) | (array[offset + 3] << 24);
}

function readInt32LE(array, offset) {
    let value = readUInt32LE(array, offset);
    return value & 0x80000000 ? value - 0x100000000 : value;
}

function DIB(array, tags = METADATA_AND_IMAGE | DEBUGGING) {
    if (array instanceof ArrayBuffer) array = new Uint8Array(array);
    else if (!(array instanceof Uint8Array)) throw new TypeError("Expected a Uint8Array or an ArrayBuffer.");

    if (!(array[0] === 66 && array[1] === 77)) throw new TypeError("Invalid BMP file: missing 'BM' header.");

    let fileSize = readUInt32LE(array, 2);
    let fileTampered = fileSize !== array.byteLength;
    if (fileTampered && tags & DEBUGGING) console.warn("Warning: File size mismatch, possible corruption.");

    let imageDataStarter = readUInt32LE(array, 10);
    if (imageDataStarter >= fileSize) console.warn("Warning: Image data pointer is out of bounds.");

    let headerSize = readUInt32LE(array, 14);
    if (![40, 52, 56, 108, 124].includes(headerSize)) {
        if (tags & DEBUGGING) console.warn("Unsupported header size:", headerSize);
        return { "status": "unsupportedHeader", "reason": "Header size not supported yet" };
    }

    let width = readInt32LE(array, 18);
    let height = readInt32LE(array, 22);
    let colorDepth = (array[28]) | (array[29] << 8);
    let compressionType = readUInt32LE(array, 30);

    let result = {
        "startHeader": "BM",
        "fileSize": fileSize,
        "imageDataPointer": imageDataStarter,
        "headerSize": headerSize,
        "width": width,
        "height": height,
        "colorDepth": colorDepth,
        "compressionType": compressionType,
        "isFilePossiblyTampered": fileTampered
    };

    // If only metadata is requested, return early
    if (tags % 2 === METADATA_ONLY) {
        return result;
    }

    // Extract color palette if needed (for 1, 4, or 8-bit images)
    let colorPalette = null;
    if (colorDepth === 1 || colorDepth === 4 || colorDepth === 8) {
        let paletteSize = Math.pow(2, colorDepth) * 4; // 4 bytes per color
        colorPalette = new Uint8Array(paletteSize);

        // Read the color palette (after the header, before the pixel data)
        for (let i = 0; i < paletteSize; i++) {
            colorPalette[i] = array[imageDataStarter + i];
        }
        result.colorPalette = colorPalette;
    }

    // Extract pixel data only if requested and uncompressed 24-bit or with palette
    if ((tags & METADATA_AND_IMAGE) && (compressionType === 0 && colorDepth === 24 || colorDepth <= 8)) {
        let rowSize = Math.ceil((width * 3 + 3) / 4) * 4; // BMP rows are padded to 4-byte multiples
        let pixelArray = new Uint8Array(width * height * 3); // Flattened RGB array
        let rowIndex = 0;

        for (let y = height - 1; y >= 0; y--) { // BMP is stored bottom-left to up-right, similar to TARGA images
            let rowOffset = imageDataStarter + paletteSize + y * rowSize; // Adjust for palette size
            for (let x = 0; x < width; x++) {
                let pixelOffset = rowOffset + x;
                let destIndex = rowIndex * width * 3 + x * 3;

                // If the image uses a color palette (1, 4, 8-bit images), look up the RGB values from the palette
                if (colorDepth <= 8) {
                    let paletteIndex = array[pixelOffset];
                    let colorOffset = paletteIndex * 4;
                    pixelArray[destIndex] = colorPalette[colorOffset + 2];   // Red
                    pixelArray[destIndex + 1] = colorPalette[colorOffset + 1]; // Green
                    pixelArray[destIndex + 2] = colorPalette[colorOffset];     // Blue
                } else {
                    let pixelOffset24 = rowOffset + x * 3;
                    pixelArray[destIndex] = array[pixelOffset24 + 2];     // Red
                    pixelArray[destIndex + 1] = array[pixelOffset24 + 1]; // Green
                    pixelArray[destIndex + 2] = array[pixelOffset24];     // Blue
                }
            }
            rowIndex++;
        }

        result.imageData = pixelArray; // Store extracted RGB pixel array
    }

    return result;
}
