import sharp from 'sharp';

export async function analyzeImageContrast(imageBuffer:Buffer) {
    const image = sharp(imageBuffer);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    const pixels = data;
  
    let minLuminance = Infinity;
    let maxLuminance = -Infinity;
  
    for (let i = 0; i < pixels.length; i += 3) { // Assuming the image is in RGB format
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  
        if (luminance < minLuminance) {
            minLuminance = luminance;
        }
        if (luminance > maxLuminance) {
            maxLuminance = luminance;
        }
    }
  
    const contrastRatio = calculateContrastRatio(maxLuminance, minLuminance);
  
    return { isGoodContrast: contrastRatio >= 4.5, contrastRatio };
  }
  
  function calculateContrastRatio(luminance1 : number, luminance2 : number) {
    const L1 = Math.max(luminance1, luminance2) + 0.05;
    const L2 = Math.min(luminance1, luminance2) + 0.05;
    return L1 / L2;
  }
  
  