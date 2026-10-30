import Foundation
import PDFKit
import AppKit
let source = URL(fileURLWithPath: CommandLine.arguments[1])
guard let document = PDFDocument(url: source) else { fatalError("Invalid PDF") }
for index in 0..<document.pageCount {
 guard let page = document.page(at: index) else { fatalError("Missing page") }
 let bounds = page.bounds(for: .mediaBox)
 let width = Int(bounds.width * 1.5), height = Int(bounds.height * 1.5)
 guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0), let graphics = NSGraphicsContext(bitmapImageRep: bitmap) else { fatalError("Cannot create bitmap") }
 NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current = graphics
 graphics.cgContext.setFillColor(NSColor.white.cgColor); graphics.cgContext.fill(CGRect(x:0,y:0,width:width,height:height))
 graphics.cgContext.scaleBy(x: 1.5,y: 1.5); page.draw(with: .mediaBox,to:graphics.cgContext)
 NSGraphicsContext.restoreGraphicsState()
 try bitmap.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:"artifacts/pdf-page-\(index+1).png"))
}
print("Rendered \(document.pageCount) PDF pages")
