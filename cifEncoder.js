// HCIF stands for "Highly Compressed Image Format"
const HCIF_PALETTE = 1, SET_ENCODE = 0, SET_DECODE = 1, SET_AUTO = 2;

function HCIF(imageData, configs = HCIF_PALETTE, mani = SET_AUTO) {
	if (mani === SET_AUTO) {
		if (imageData instanceof ImageData) mani = SET_ENCODE; else if (imageData instanceof Uint8Array || imageData instanceof Uint8ClampedArray) mani = SET_DECODE; else if (imageData instanceof ArrayBuffer) {
			imageData = new Uint8Array(imageData);
			mani = SET_DECODE;
		} else throw new TypeError("Only ImageData, Uint8Array, Uint8ClampedArray and ArrayBuffer types are accepted for encoding images.");
	}

	if (mani === SET_ENCODE) {
		const chunks = [];
		let header = new Uint8Array(10);
		header[0] = 67; //  C
		header[1] = 73; //  I
		header[2] = configs; // flags
		header[3] = imageData.width & 255; // Width (smaller byte)
		header[4] = imageData.width << 8; // Width (bigger byte)
		header[5] = imageData.height & 255; // Height (smaller byte)
		header[6] = imageData.height << 8; // Height (bigger byte)
		// header[7] is reserved. Even if changed, nothing affects the image
		let currentByteRead = 8;
		let paletteChunks = [], gridChunks = [];
		const imageDataLen = imageData.data.byteLength, data = imageData.data;

		function includesColor(r, g, b, a) {
			for (const p of paletteChunks) {
				if (p[0] === r && p[1] === g && p[2] === b && p[3] === a) return true;
			}
			return false;
		}

		if (configs & HCIF_PALETTE) {
			let r, g, b, a;
			for (let i = 0; i < imageDataLen;) {
				r = data[i]; g = data[i + 1]; b = data[i + 2]; a = data[i + 3];
				if (!includesColor(r, g, b, a)) {
					paletteChunks.push(new Uint8Array([r, g, b, a]));
					if (paletteChunks.length > 65535) {
						paletteChunks = [];
						throw new Error("The palette size has reached a color overflow; there are more colors than 65536.");
					}
				}
				i += 4;
			}
			header[currentByteRead] = (paletteChunks.length - 1) & 255; currentByteRead++;
			header[currentByteRead] = (paletteChunks.length - 1) << 8; currentByteRead++;
			chunks.push(header);
			header = new Uint8Array(paletteChunks.reduce((acc, chunk) => acc + (chunk[3] === 0 ? 1 : 4), 0));
			currentByteRead = 0;
			let currentPalChunk = 0, cc;
			for (; currentByteRead < header.byteLength; currentByteRead++) {
				cc = paletteChunks[currentPalChunk];
				if (cc[3] === 0) {} else {
					header[currentByteRead] = cc[3]; currentByteRead++;
					header[currentByteRead] = cc[0]; currentByteRead++;
					header[currentByteRead] = cc[1]; currentByteRead++;
					header[currentByteRead] = cc[2];
				}
			}
		}
		const trueResult = new Uint8Array(chunks.reduce((a, b) => a + b.byteLength));
		let current = 0;
		for (const l of chunks) {
			trueResult.set(l, current);
			current += l.byteLength;
		}
		return trueResult;
	} else if (mani === SET_DECODE) {
		
	} else {
		throw new TypeError("Either the image data should be encoded, or the image should be decoded, because neither of those values are provided.");
	}
}
