import AVFoundation
import CoreGraphics
import Foundation

// Makes synthetic test videos written by Apple's own video library, like the iPhone's.
// Build: swiftc -O scripts/makevideo.swift -o scripts/makevideo
// Usage: scripts/makevideo out.mov codec(hevc|h264) width height fps seconds rotate(0|1) isoDate [caption]
let a = CommandLine.arguments
let url = URL(fileURLWithPath: a[1])
let codec: AVVideoCodecType = a[2] == "hevc" ? .hevc : .h264
let w = Int(a[3])!, h = Int(a[4])!, fps = Int32(a[5])!, secs = Double(a[6])!, rotate = a[7] == "1"
let date = a[8]
try? FileManager.default.removeItem(at: url)

let writer = try! AVAssetWriter(outputURL: url, fileType: .mov)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: codec, AVVideoWidthKey: w, AVVideoHeightKey: h,
])
input.expectsMediaDataInRealTime = false
if rotate { input.transform = CGAffineTransform(rotationAngle: .pi / 2) }
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB, kCVPixelBufferWidthKey as String: w, kCVPixelBufferHeightKey as String: h,
])
writer.add(input)
let item = AVMutableMetadataItem()
item.key = "com.apple.quicktime.creationdate" as NSString
item.keySpace = .quickTimeMetadata
item.value = date as NSString
item.dataType = kCMMetadataBaseDataType_UTF8 as String
var items = [item]
if a.count > 9 {
  let cap = AVMutableMetadataItem()
  cap.key = "com.apple.quicktime.description" as NSString
  cap.keySpace = .quickTimeMetadata
  cap.value = a[9] as NSString
  cap.dataType = kCMMetadataBaseDataType_UTF8 as String
  items.append(cap)
}
writer.metadata = items
writer.startWriting()
writer.startSession(atSourceTime: .zero)

let frames = Int(Double(fps) * secs)
for i in 0..<frames {
  while !input.isReadyForMoreMediaData { usleep(1000) }
  var pb: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
  let buf = pb!
  CVPixelBufferLockBaseAddress(buf, [])
  let ctx = CGContext(data: CVPixelBufferGetBaseAddress(buf), width: w, height: h, bitsPerComponent: 8,
    bytesPerRow: CVPixelBufferGetBytesPerRow(buf), space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
  ctx.setFillColor(red: 0.3, green: 0.55, blue: 0.3, alpha: 1)
  ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
  // A swinging bar so frames differ.
  let t = Double(i) / Double(frames)
  let angle = -2.5 + 5.0 * t
  let cx = Double(w) / 2, cy = Double(h) / 2, r = Double(min(w, h)) * 0.4
  ctx.setStrokeColor(red: 1, green: 1, blue: 1, alpha: 1)
  ctx.setLineWidth(CGFloat(max(4, min(w, h) / 60)))
  ctx.move(to: CGPoint(x: cx, y: cy))
  ctx.addLine(to: CGPoint(x: cx + r * sin(angle), y: cy - r * cos(angle)))
  ctx.strokePath()
  CVPixelBufferUnlockBaseAddress(buf, [])
  adaptor.append(buf, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: fps))
}
input.markAsFinished()
let sem = DispatchSemaphore(value: 0)
writer.finishWriting { sem.signal() }
sem.wait()
print(writer.status == .completed ? "ok \(a[1])" : "failed \(String(describing: writer.error))")
