import AVFoundation
import AVKit
import UIKit
import WebKit

@MainActor
final class CallPictureInPictureController: NSObject, AVPictureInPictureControllerDelegate, AVAudioPlayerDelegate {
    static let shared = CallPictureInPictureController()

    private weak var webView: WKWebView?
    private var sourceView: UIView?
    private var pictureController: AVPictureInPictureController?
    private var contentController: AVPictureInPictureVideoCallViewController?
    private let nameLabel = UILabel()
    private let stateLabel = UILabel()
    private let subtitleView = CallSubtitleView()
    private var subtitleMinimumHeight: NSLayoutConstraint?
    private var audioPlayer: AVAudioPlayer?
    private var audioCompletion: ((Bool) -> Void)?

    func attach(to webView: WKWebView?) {
        self.webView = webView
    }

    func start(
        name: String,
        kind: String,
        subtitle: String,
        subtitleWho: String,
        subtitleMotion: [String: Any]
    ) -> Bool {
        guard AVPictureInPictureController.isPictureInPictureSupported(), let webView else {
            return false
        }
        if pictureController == nil {
            let source = UIView(frame: CGRect(x: 1, y: 1, width: 2, height: 2))
            source.isUserInteractionEnabled = false
            source.backgroundColor = UIColor.black.withAlphaComponent(0.01)
            webView.addSubview(source)
            sourceView = source

            let videoCall = AVPictureInPictureVideoCallViewController()
            videoCall.preferredContentSize = CGSize(width: 360, height: 144)
            configureContent(in: videoCall.view)
            contentController = videoCall

            let contentSource = AVPictureInPictureController.ContentSource(
                activeVideoCallSourceView: source,
                contentViewController: videoCall
            )
            let controller = AVPictureInPictureController(contentSource: contentSource)
            controller.delegate = self
            controller.canStartPictureInPictureAutomaticallyFromInline = true
            pictureController = controller
        }
        update(
            name: name,
            kind: kind,
            subtitle: subtitle,
            subtitleWho: subtitleWho,
            subtitleMotion: subtitleMotion,
            screenSharing: false
        )
        activateCallAudio()
        return true
    }

    func update(
        name: String,
        kind: String,
        subtitle: String,
        subtitleWho: String,
        subtitleMotion: [String: Any],
        screenSharing: Bool
    ) {
        nameLabel.text = name.isEmpty ? "角色" : name
        stateLabel.text = screenSharing ? "屏幕共享中" : (kind == "video" ? "视频通话" : "语音通话")
        updateSubtitle(subtitle, who: subtitleWho, motion: subtitleMotion)
    }

    private func updateSubtitle(
        _ subtitle: String,
        who: String,
        motion: [String: Any]
    ) {
        let hasSubtitle = !subtitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        subtitleView.isHidden = !hasSubtitle
        subtitleMinimumHeight?.isActive = hasSubtitle
        subtitleView.update(text: subtitle, who: who, motion: motion)
    }

    func end() {
        if pictureController?.isPictureInPictureActive == true {
            pictureController?.stopPictureInPicture()
        }
        pictureController = nil
        contentController = nil
        sourceView?.removeFromSuperview()
        sourceView = nil
        stopAudio()
    }

    func playAudio(data: Data, volume: Float, completion: @escaping (Bool) -> Void) {
        stopAudio()
        activateCallAudio()
        do {
            let player = try AVAudioPlayer(data: data)
            player.delegate = self
            player.volume = max(0, min(1, volume))
            player.prepareToPlay()
            audioPlayer = player
            audioCompletion = completion
            guard player.play() else {
                stopAudio(result: false)
                return
            }
        } catch {
            completion(false)
        }
    }

    func stopAudio(result: Bool = false) {
        audioPlayer?.stop()
        audioPlayer = nil
        let completion = audioCompletion
        audioCompletion = nil
        completion?(result)
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            guard self.audioPlayer === player else { return }
            self.audioPlayer = nil
            let completion = self.audioCompletion
            self.audioCompletion = nil
            completion?(flag)
        }
    }

    private func activateCallAudio() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(
            .playAndRecord,
            mode: .voiceChat,
            options: [.defaultToSpeaker, .allowBluetoothHFP, .mixWithOthers]
        )
        try? session.setActive(true)
    }

    private func configureContent(in root: UIView) {
        root.isOpaque = false
        // The system owns the outer PiP surface. Keep our content fully clear;
        // iOS may still provide its own black backing, but the App must not add
        // a second opaque panel that hides the screen underneath.
        root.backgroundColor = .clear
        root.layer.borderWidth = 0
        nameLabel.font = .systemFont(ofSize: 17, weight: .semibold)
        nameLabel.textColor = .white
        nameLabel.textAlignment = .center
        stateLabel.font = .systemFont(ofSize: 11, weight: .medium)
        stateLabel.textColor = UIColor.white.withAlphaComponent(0.62)
        stateLabel.textAlignment = .center
        subtitleView.isHidden = true

        [nameLabel, stateLabel].forEach { label in
            label.layer.shadowColor = UIColor.black.cgColor
            label.layer.shadowOpacity = 0.72
            label.layer.shadowRadius = 2.5
            label.layer.shadowOffset = CGSize(width: 0, height: 1)
        }

        let stack = UIStackView(arrangedSubviews: [nameLabel, stateLabel, subtitleView])
        stack.axis = .vertical
        stack.alignment = .fill
        stack.spacing = 3
        stack.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(stack)
        nameLabel.setContentHuggingPriority(.required, for: .vertical)
        stateLabel.setContentHuggingPriority(.required, for: .vertical)
        let subtitleHeight = subtitleView.heightAnchor.constraint(greaterThanOrEqualToConstant: 56)
        subtitleMinimumHeight = subtitleHeight
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),
            stack.topAnchor.constraint(equalTo: root.topAnchor, constant: 10),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: root.bottomAnchor, constant: -8)
        ])
    }
}

private final class CallSubtitleView: UIView {
    private struct Item {
        let character: Character
        let label: UILabel?
    }

    private let subtitleFont = UIFont.systemFont(ofSize: 14, weight: .medium)
    private var items: [Item] = []
    private var currentText = ""
    private var currentWho = ""
    private var animatedStartIndex = 0
    private var activeAnimators: [UIViewPropertyAnimator] = []
    private var motion: [String: CGFloat] = [
        "charDurationMs": 420,
        "charStaggerMs": 24,
        "maxDelayMs": 420,
        "lineDurationMs": 260,
        "translateY": 5,
        "scale": 0.96,
        "charX1": 0.25,
        "charY1": 0.1,
        "charX2": 0.25,
        "charY2": 1,
        "lineX1": 0.22,
        "lineY1": 0.78,
        "lineX2": 0.23,
        "lineY2": 1
    ]

    func update(text: String, who: String, motion rawMotion: [String: Any]) {
        guard text != currentText || who != currentWho else { return }
        for key in Array(motion.keys) {
            if let value = rawMotion[key] as? NSNumber {
                motion[key] = CGFloat(truncating: value)
            }
        }
        let isAppend = who == currentWho && text.hasPrefix(currentText)
        animatedStartIndex = isAppend ? currentText.filter { $0 != "\n" }.count : 0
        currentText = text
        currentWho = who
        rebuildItems()
    }

    private func rebuildItems() {
        activeAnimators.forEach { $0.stopAnimation(true) }
        activeAnimators.removeAll()
        subviews.forEach { $0.removeFromSuperview() }
        items = currentText.map { character in
            guard character != "\n" else { return Item(character: character, label: nil) }
            let label = UILabel()
            label.text = String(character)
            label.font = subtitleFont
            label.textColor = .white
            label.textAlignment = .center
            label.layer.shadowColor = UIColor.black.cgColor
            label.layer.shadowOpacity = 0.72
            label.layer.shadowRadius = 2.5
            label.layer.shadowOffset = CGSize(width: 0, height: 1)
            addSubview(label)
            return Item(character: character, label: label)
        }
        setNeedsLayout()
        layoutIfNeeded()
        animateNewCharacters()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        guard bounds.width > 0 else { return }
        let lineHeight = ceil(subtitleFont.lineHeight)
        var lines: [[(UILabel, CGFloat)]] = [[]]
        var lineWidths: [CGFloat] = [0]
        for item in items {
            guard let label = item.label else {
                if lines.count < 4 {
                    lines.append([])
                    lineWidths.append(0)
                }
                continue
            }
            let width = max(3, ceil((label.text! as NSString).size(withAttributes: [.font: subtitleFont]).width))
            let lineIndex = lines.count - 1
            if !lines[lineIndex].isEmpty && lineWidths[lineIndex] + width > bounds.width && lines.count < 4 {
                lines.append([(label, width)])
                lineWidths.append(width)
            } else {
                lines[lineIndex].append((label, width))
                lineWidths[lineIndex] += width
            }
        }
        let totalHeight = CGFloat(lines.count) * lineHeight
        var y = max(0, (bounds.height - totalHeight) / 2)
        for (index, line) in lines.enumerated() {
            var x = max(0, (bounds.width - lineWidths[index]) / 2)
            for (label, width) in line {
                label.frame = CGRect(x: x, y: y, width: width, height: lineHeight)
                x += width
            }
            y += lineHeight
        }
    }

    private func animateNewCharacters() {
        let labels = items.compactMap(\.label)
        let start = min(animatedStartIndex, labels.count)
        let duration = TimeInterval((motion["charDurationMs"] ?? 420) / 1_000)
        let charTiming = UICubicTimingParameters(
            controlPoint1: CGPoint(x: motion["charX1"] ?? 0.25, y: motion["charY1"] ?? 0.1),
            controlPoint2: CGPoint(x: motion["charX2"] ?? 0.25, y: motion["charY2"] ?? 1)
        )
        let stagger = motion["charStaggerMs"] ?? 24
        let maxDelay = motion["maxDelayMs"] ?? 420
        let translateY = motion["translateY"] ?? 5
        let scale = motion["scale"] ?? 0.96
        for (index, label) in labels.enumerated() {
            guard index >= start else {
                label.alpha = 1
                label.transform = .identity
                continue
            }
            label.alpha = 0
            label.transform = CGAffineTransform(translationX: 0, y: translateY)
                .scaledBy(x: scale, y: scale)
            let delay = TimeInterval(min(maxDelay, CGFloat(index - start) * stagger) / 1_000)
            let animator = UIViewPropertyAnimator(duration: duration, timingParameters: charTiming)
            animator.addAnimations {
                label.alpha = 1
                label.transform = .identity
            }
            activeAnimators.append(animator)
            animator.startAnimation(afterDelay: delay)
        }
        if start == 0 && !labels.isEmpty {
            alpha = 0.62
            transform = CGAffineTransform(translationX: 0, y: motion["translateY"] ?? 5)
            let lineTiming = UICubicTimingParameters(
                controlPoint1: CGPoint(x: motion["lineX1"] ?? 0.22, y: motion["lineY1"] ?? 0.78),
                controlPoint2: CGPoint(x: motion["lineX2"] ?? 0.23, y: motion["lineY2"] ?? 1)
            )
            let animator = UIViewPropertyAnimator(
                duration: TimeInterval((motion["lineDurationMs"] ?? 260) / 1_000),
                timingParameters: lineTiming
            )
            animator.addAnimations {
                self.alpha = 1
                self.transform = .identity
            }
            activeAnimators.append(animator)
            animator.startAnimation()
        }
    }
}
