import Foundation
import AppKit

let root = FileManager.default.currentDirectoryPath
let markUrl = URL(fileURLWithPath: root + "/public/sanctuary-mark.svg")
let mohsinUrl = URL(fileURLWithPath: root + "/public/mohsin-project-logo-white.svg")

guard let markImage = NSImage(contentsOf: markUrl) else {
    print("Error: Could not load sanctuary-mark.svg")
    exit(1)
}

guard let mohsinImage = NSImage(contentsOf: mohsinUrl) else {
    print("Error: Could not load mohsin-project-logo-white.svg")
    exit(1)
}

let bgColor = NSColor(srgbRed: 27/255.0, green: 67/255.0, blue: 50/255.0, alpha: 1.0)
let titleColor = NSColor(srgbRed: 232/255.0, green: 238/255.0, blue: 233/255.0, alpha: 1.0)
let subColor = NSColor(srgbRed: 212/255.0, green: 229/255.0, blue: 208/255.0, alpha: 0.90)
let footerColor = NSColor(srgbRed: 212/255.0, green: 229/255.0, blue: 208/255.0, alpha: 0.85)

func savePNG(image: NSImage, width: Int, height: Int, to path: String) {
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: width,
        pixelsHigh: height,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!
    rep.size = NSSize(width: width, height: height)

    let ctx = NSGraphicsContext(bitmapImageRep: rep)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = ctx
    ctx.cgContext.setAllowsAntialiasing(true)
    ctx.cgContext.setShouldAntialias(true)
    ctx.cgContext.interpolationQuality = .high

    image.draw(in: NSRect(x: 0, y: 0, width: width, height: height))

    NSGraphicsContext.restoreGraphicsState()

    guard let pngData = rep.representation(using: .png, properties: [:]) else {
        print("Error: Could not generate PNG representation for \(path)")
        return
    }

    try? pngData.write(to: URL(fileURLWithPath: path))
    print("Saved \(path) (\(width)x\(height))")
}

// 1. Generate PWA Icons
func generatePwaIcons() {
    let icons: [(String, Int, Double)] = [
        ("public/pwa-192x192.png", 192, 0.72),
        ("public/pwa-512x512.png", 512, 0.72),
        ("public/pwa-512x512-maskable.png", 512, 0.58),
        ("public/apple-touch-icon.png", 180, 0.72)
    ]

    for (relPath, size, scale) in icons {
        let fullPath = root + "/" + relPath
        let img = NSImage(size: NSSize(width: size, height: size))
        img.lockFocus()

        // Full solid background
        bgColor.setFill()
        NSRect(x: 0, y: 0, width: size, height: size).fill()

        // Centered line art mark
        let markSize = CGFloat(size) * CGFloat(scale)
        let markRect = NSRect(
            x: (CGFloat(size) - markSize) / 2.0,
            y: (CGFloat(size) - markSize) / 2.0,
            width: markSize,
            height: markSize
        )
        markImage.draw(in: markRect, from: .zero, operation: .sourceOver, fraction: 1.0)

        img.unlockFocus()
        savePNG(image: img, width: size, height: size, to: fullPath)
    }
}

// 2. Generate Splash Screens
func generateSplashes() {
    let splashes: [(Int, Int)] = [
        (750, 1334),
        (828, 1792),
        (1125, 2436),
        (1170, 2532),
        (1179, 2556),
        (1242, 2688),
        (1290, 2796),
        (1668, 2388),
        (2048, 2732)
    ]

    for (w, h) in splashes {
        let fullPath = root + "/public/splashes/splash-\(w)x\(h).png"
        let img = NSImage(size: NSSize(width: w, height: h))
        img.lockFocus()

        // Full solid background
        bgColor.setFill()
        NSRect(x: 0, y: 0, width: w, height: h).fill()

        let minDim = CGFloat(min(w, h))

        // Sizes
        let logoSize = round(minDim * 0.28)
        let titleFontSize = round(minDim * 0.082)
        let subFontSize = round(minDim * 0.034)
        let gapLogoToTitle = round(minDim * 0.030)
        let gapTitleToSub = round(minDim * 0.016)

        let titleFont = NSFont.systemFont(ofSize: titleFontSize, weight: .bold)
        let subFont = NSFont.systemFont(ofSize: subFontSize, weight: .medium)

        let titleAttrs: [NSAttributedString.Key: Any] = [
            .font: titleFont,
            .foregroundColor: titleColor,
            .kern: -0.02 * titleFontSize
        ]
        let subAttrs: [NSAttributedString.Key: Any] = [
            .font: subFont,
            .foregroundColor: subColor,
            .kern: -0.01 * subFontSize
        ]

        let titleStr = NSAttributedString(string: "Sanctuary", attributes: titleAttrs)
        let subStr = NSAttributedString(string: "Animal welfare platform", attributes: subAttrs)

        let titleSize = titleStr.size()
        let subSize = subStr.size()

        let totalCenterHeight = logoSize + gapLogoToTitle + titleSize.height + gapTitleToSub + subSize.height

        // Sits slightly above pure geometric center for optical balance
        let startY = (CGFloat(h) - totalCenterHeight) / 2.0 + round(CGFloat(h) * 0.015)

        // Subheading (bottom of center group in standard AppKit coords)
        let subY = startY
        let subX = (CGFloat(w) - subSize.width) / 2.0
        subStr.draw(at: NSPoint(x: subX, y: subY))

        // Title
        let titleY = subY + subSize.height + gapTitleToSub
        let titleX = (CGFloat(w) - titleSize.width) / 2.0
        titleStr.draw(at: NSPoint(x: titleX, y: titleY))

        // Logo Mark
        let logoY = titleY + titleSize.height + gapLogoToTitle
        let logoX = (CGFloat(w) - logoSize) / 2.0
        let logoRect = NSRect(x: logoX, y: logoY, width: logoSize, height: logoSize)
        markImage.draw(in: logoRect, from: .zero, operation: .sourceOver, fraction: 1.0)

        // Footer at bottom
        let footerFontSize = round(minDim * 0.030)
        let footerFont = NSFont.systemFont(ofSize: footerFontSize, weight: .medium)
        let footerAttrs: [NSAttributedString.Key: Any] = [
            .font: footerFont,
            .foregroundColor: footerColor,
            .kern: -0.01 * footerFontSize
        ]
        let footerStr = NSAttributedString(string: "Free software by The Mohsin Project", attributes: footerAttrs)
        let footerStrSize = footerStr.size()

        let birdHeight = round(footerFontSize * 1.55)
        let birdWidth = round(birdHeight * (2444.0 / 1404.0))
        let footerGap = round(footerFontSize * 0.55)

        let totalFooterWidth = footerStrSize.width + footerGap + birdWidth
        let footerStartX = (CGFloat(w) - totalFooterWidth) / 2.0
        let footerY = round(CGFloat(h) * 0.065)

        footerStr.draw(at: NSPoint(x: footerStartX, y: footerY + (birdHeight - footerStrSize.height) / 2.0))

        let birdRect = NSRect(
            x: footerStartX + footerStrSize.width + footerGap,
            y: footerY,
            width: birdWidth,
            height: birdHeight
        )
        mohsinImage.draw(in: birdRect, from: .zero, operation: .sourceOver, fraction: 1.0)

        img.unlockFocus()
        savePNG(image: img, width: w, height: h, to: fullPath)
    }
}

print("Starting asset generation...")
generatePwaIcons()
generateSplashes()
print("All assets generated successfully!")
