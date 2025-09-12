// I used a lot of GPT-4.0 and GPT-4.0 Mini (six months ago when this was updated), and GPT-5.0 Mini for this project, but there is some of my code as well, so it's technically my AI-assisted implementation.
/*
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
	if (fileTampered && tags & DEBUGGING) console.warn("Warning: The BMP file size has a mismatch.");

	let imageDataStarter = readUInt32LE(array, 10);
	if (imageDataStarter >= fileSize && tags & DEBUGGING) console.warn("Warning: Image data pointer is out of bounds.");

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
	if (!(tags & 1)) {
		return result;
	}

	// Extract color palette if needed (for 1, 4, or 8-bit images)
	let colorPalette = null;
	if (colorDepth === 1 || colorDepth === 4 || colorDepth === 8) {
		let paletteSize = Math.pow(2, colorDepth) * 4; // 4 bytes per color
		colorPalette = new Uint8Array(paletteSize);

		// Read the color palette (after the DIB header, before the pixel data)
		let paletteOffset = 14 + headerSize;
		for (let i = 0; i < paletteSize; i++) {
			colorPalette[i] = array[paletteOffset + i];
		}
		result.colorPalette = colorPalette;
	}

	// Determine if the image is top-down (negative height)
	let topDown = height < 0;
	let absHeight = Math.abs(height);

	// Only extract pixel data for supported types
	if (compressionType === 0) { // Uncompressed
		let rowSize;
		let pixelArray = new Uint8Array(width * absHeight * 4); // Flattened RGBA array
		let rowIndex = 0;
		const widthCache = (width << 1) + width; // Similar to width * 3, but with bitwise + add optimizations

		if (colorDepth === 24) {
			rowSize = Math.ceil(widthCache * 0.25) * 4; // If anyone is confused, this would return Math.ceil(widthCache / 4) * 4
			for (let y = 0; y < absHeight; y++) {
				let row = topDown ? y : absHeight - 1 - y;
				let rowOffset = imageDataStarter + row * rowSize;
				let cacheX;
				for (let x = 0; x < width; x++) {
					cacheX = (x << 1) + x;
					let pixelOffset = rowOffset + cacheX;
					let destIndex = rowIndex * widthCache + cacheX + x;
					pixelArray[destIndex] = array[pixelOffset + 2]; // R
					pixelArray[destIndex + 1] = array[pixelOffset + 1]; // G
					pixelArray[destIndex + 2] = array[pixelOffset];	 // B
					pixelArray[destIndex + 3] = 255;
				}
				rowIndex++;
			}
		} else if (colorDepth === 8 || colorDepth === 4 || colorDepth === 1) {
			// Each row is padded to 4-byte boundaries
			rowSize = Math.ceil((width * colorDepth + 31) * 0.03125) * 4;
			for (let y = 0; y < absHeight; y++) {
				let row = topDown ? y : absHeight - 1 - y;
				let rowOffset = imageDataStarter + row * rowSize;
				let bitMask, bitsPerPixel = colorDepth;

				let trueColor = colorDepth === 8, middleColor = colorDepth === 4;

				let cacheX;
	
				for (let x = 0; x < width; x++) {
					let byteIndex, shift;
					cacheX = x << 2;
					if (trueColor) {
						byteIndex = rowOffset + x;
						shift = 0;
					} else if (middleColor) {
						byteIndex = rowOffset + (x >> 1);
						shift = (1 - (x & 1)) * 4;
					} else { // 1-bit
						byteIndex = rowOffset + (x >> 3);
						shift = 7 - (x & 7);
					}

					let paletteIndex = (array[byteIndex] >> shift) & ((1 << bitsPerPixel) - 1);
					let colorOffset = paletteIndex << 2; // Same as paletteIndex * 4

					let destIndex = rowIndex * widthCache + cacheX;
					pixelArray[destIndex] = colorPalette[colorOffset + 2]; // R
					pixelArray[destIndex + 1] = colorPalette[colorOffset + 1]; // G
					pixelArray[destIndex + 2] = colorPalette[colorOffset];	 // B
					pixelArray[destIndex + 3] = 255; // A (not directly specified)
				}
				rowIndex++;
			}
		}

		result.imageData = pixelArray;
	}
	// Handle RLE-compressed BMP (8-bit or 4-bit)
	else if (compressionType === 1 || compressionType === 2) {
		let isRLE8 = compressionType === 1;
		let x = 0, y = 0;
		let ptr = imageDataOffset;

		while (ptr < array.length && y < absHeight) {
			let count = array[ptr++];
			let value = array[ptr++];

			if (count > 0) {
				// Encoded mode
				for (let i = 0; i < count; i++) {
					if (x >= width) {
						x = 0;
						y++;
						if (y >= absHeight) break;
					}

					let destIndex = ((topDown ? y : absHeight - 1 - y) * width + x) * 3;

					if (isRLE8) {
						let colorOffset = value * 4;
						pixelArray[destIndex]	 = colorPalette[colorOffset + 2]; // R
						pixelArray[destIndex + 1] = colorPalette[colorOffset + 1]; // G
						pixelArray[destIndex + 2] = colorPalette[colorOffset];	 // B
					} else { // RLE4
						let pixelVal = (i & 1) === 0 ? (value >> 4) : (value & 0x0F);
						let colorOffset = pixelVal * 4;
						pixelArray[destIndex]	 = colorPalette[colorOffset + 2];
						pixelArray[destIndex + 1] = colorPalette[colorOffset + 1];
						pixelArray[destIndex + 2] = colorPalette[colorOffset];
					}
					x++;
				}
			} else {
				// Escape codes
				if (value === 0) { // End of line
					x = 0;
					y++;
				} else if (value === 1) { // End of bitmap
					break;
				} else if (value === 2) { // Delta
					let dx = array[ptr++];
					let dy = array[ptr++];
					x += dx;
					y += dy;
				} else {
					// Absolute mode
					let absCount = value;
					for (let i = 0; i < absCount; i++) {
						let pixelVal = isRLE8 ? array[ptr++] : ((i & 1) === 0 ? array[ptr] >> 4 : array[ptr++] & 0x0F);
						let destIndex = ((topDown ? y : absHeight - 1 - y) * width + x) * 3;
						let colorOffset = pixelVal * 4;
						pixelArray[destIndex]	 = colorPalette[colorOffset + 2];
						pixelArray[destIndex + 1] = colorPalette[colorOffset + 1];
						pixelArray[destIndex + 2] = colorPalette[colorOffset];
						x++;
					}
					// Align ptr to even boundary for RLE
					if (!isRLE8 && (absCount & 1) === 1) ptr++;
				}
			}
		}
	} else {
		if (tags & DEBUGGING) console.warn("Unsupported compression type:", compressionType);
		pixelArray = null;
	}

	result.imageData = new Uint8ClampedArray(result.imageData);
	return result;
}*/

const METADATA_ONLY = 0;
const METADATA_AND_IMAGE = 1;
const DEBUGGING = 2;

function u32(a,o){return a[o]|(a[o+1]<<8)|(a[o+2]<<16)|(a[o+3]<<24);}
function i32(a,o){let v=u32(a,o);return v&0x80000000?v-0x100000000:v;}

function DIB(buf,tags=METADATA_AND_IMAGE){
	if(buf instanceof ArrayBuffer) buf=new Uint8Array(buf);
	else if(!(buf instanceof Uint8Array)) throw TypeError("Need Uint8Array/ArrayBuffer");
	if(buf[0]!==0x42||buf[1]!==0x4D) throw TypeError("Missing BM header");

	const fSize=u32(buf,2), tampered=fSize!==buf.length;
	const start=u32(buf,10), hSize=u32(buf,14);
	const w=i32(buf,18), h=i32(buf,22), bpp=buf[28]|(buf[29]<<8), comp=u32(buf,30);
	const topDown=h<0, H=Math.abs(h);

	let out={fileSize:fSize,width:w,height:h,colorDepth:bpp,compressionType:comp,
		imageDataPointer:start,headerSize:hSize,isFilePossiblyTampered:tampered};

	if(!(tags&METADATA_AND_IMAGE)) return out;

	// Palette if needed
	let pal=null;
	if(bpp<=8){
		let used=(hSize>=40)?u32(buf,46):0; if(!used) used=1<<bpp;
		let off=14+hSize, size=used*4;
		pal=buf.subarray(off,off+size); out.colorPalette=pal;
	}

	const RGBA=new Uint8ClampedArray(w*H*4);
	const strideBits=w*bpp;
	const rowSize=((strideBits+31)>>5)<<2; // 4-byte aligned

	// helpers
	const setPix=(idx,r,g,b)=>{RGBA[idx]=r;RGBA[idx+1]=g;RGBA[idx+2]=b;RGBA[idx+3]=255;};

	// --- Uncompressed ---
	if(comp===0){
		switch(bpp){
			case 24:{
				for(let y=0;y<H;y++){
					let src=start+(topDown?y:(H-1-y))*rowSize, dst=(y*w)<<2;
					for(let x=0;x<w;x++,src+=3,dst+=4){
						setPix(dst,buf[src+2],buf[src+1],buf[src]);
					}
				} break;
			}
			case 8: case 4: case 1:{
				for(let y=0;y<H;y++){
					let src=start+(topDown?y:(H-1-y))*rowSize, dst=(y*w)<<2;
					for(let x=0;x<w;x++,dst+=4){
						let pi;
						if(bpp===8) pi=buf[src+x];
						else if(bpp===4){let B=buf[src+(x>>1)];pi=(x&1)?(B&0x0F):(B>>4);}
						else{let B=buf[src+(x>>3)];pi=(B>>(7-(x&7)))&1;}
						let po=pi*4; setPix(dst,pal[po+2],pal[po+1],pal[po]);
					}
				} break;
			}
			default: if(tags&DEBUGGING) console.warn("Unsupported bpp:",bpp);
		}
	}
	// --- RLE ---
	else if(comp===1||comp===2){
		let rle8=comp===1,ptr=start,x=0,y=0;
		while(ptr<buf.length&&y<H){
			let count=buf[ptr++]; if(ptr>=buf.length) break;
			let val=buf[ptr++];
			if(count){
				for(let i=0;i<count;i++){
					if(x>=w){x=0;y++;if(y>=H)break;}
					let dst=((topDown?y:(H-1-y))*w+x)<<2;
					if(rle8){
						let po=val*4;setPix(dst,pal[po+2],pal[po+1],pal[po]);
					}else{
						let nib=(i&1)?(val&0xF):(val>>4),po=nib*4;
						setPix(dst,pal[po+2],pal[po+1],pal[po]);
					}
					x++;
				}
			}else{
				if(val===0){x=0;y++;} 
				else if(val===1) break;
				else if(val===2){x+=buf[ptr++];y+=buf[ptr++];}
				else{
					let n=val;
					if(rle8){
						for(let i=0;i<n;i++){
							let pi=buf[ptr++],po=pi*4,dst=((topDown?y:(H-1-y))*w+x)<<2;
							setPix(dst,pal[po+2],pal[po+1],pal[po]);x++;
						}
						if(n&1) ptr++;
					}else{
						for(let i=0;i<n;i++){
							let B=buf[ptr+(i>>1)],pi=(i&1)?(B&0xF):(B>>4),po=pi*4,
								dst=((topDown?y:(H-1-y))*w+x)<<2;
							setPix(dst,pal[po+2],pal[po+1],pal[po]);x++;
						}
						ptr+=Math.ceil(n/2); if((n>>1)&1) ptr++;
					}
				}
			}
		}
	}else if(tags&DEBUGGING) console.warn("Unsupported compression:",comp);

	out.imageData=RGBA;
	return out;
}
