import Foundation
import PDFKit
let path = CommandLine.arguments[1]
guard let document = PDFDocument(url: URL(fileURLWithPath: path)), document.pageCount > 0 else { fatalError("Invalid downloaded PDF") }
let text = (0..<document.pageCount).map { document.page(at: $0)?.string ?? "" }.joined(separator: "\n")
precondition(text.contains("UX recovery"), "Missing synthetic horse")
precondition(text.contains("Training Log") && text.contains("Training Trifecta Evaluation") && text.contains("+2"), "Missing saved evaluation or report sections")
print("PASS: actual browser download has \(document.pageCount) readable pages and the correct synthetic horse")
