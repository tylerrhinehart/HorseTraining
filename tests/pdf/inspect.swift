import Foundation
import PDFKit
import AppKit
let path = CommandLine.arguments[1]
guard let doc = PDFDocument(url: URL(fileURLWithPath: path)) else { fatalError("PDF unreadable") }
let text = (0..<doc.pageCount).map { doc.page(at:$0)?.string ?? "" }.joined(separator:"\n\n")
try text.write(toFile:path+".txt",atomically:true,encoding:.utf8)
for expected in ["Sale Pilot Horse", "Test sale rider", "Fence Work", "Phase 2", "Heading", "Phase 3", "Sale multiple disciplines persisted", "4.0"] { precondition(text.contains(expected), "Missing report evidence: \(expected)") }
guard let page = doc.page(at: min(2,doc.pageCount-1)) else { fatalError("Missing page") }
let image = page.thumbnail(of:NSSize(width:1224,height:1584),for:.mediaBox)
let bitmap = NSBitmapImageRep(data:image.tiffRepresentation!)!
try bitmap.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:path+".png"))
print("PASS: \(doc.pageCount) readable PDF pages; horse, rider, both independent tasks, rating and notes verified")
