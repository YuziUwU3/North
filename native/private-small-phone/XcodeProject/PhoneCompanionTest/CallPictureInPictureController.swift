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
    private let subtitleLabel = UILabel()
    private var subtitleMinimumHeight: NSLayoutConstraint?
    private var subtitleAnimator: UIViewPropertyAnimator?
    private var audioPlayer: AVAudioPlayer?
    private var audioCompletion: ((Bool) -> Void)?

    func attach(to webView: WKWebView?) {
        self.webView = webView
    }

    func start(name: String, kind: String, subtitle: String) -> Bool {
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
        update(name: name, kind: kind, subtitle: subtitle, screenSharing: false)
        activateCallAudio()
        return true
    }

    func update(name: String, kind: String, subtitle: String, screenSharing: Bool) {
        nameLabel.text = name.isEmpty ? "角色" : name
        stateLabel.text = screenSharing ? "屏幕共享中" : (kind == "video" ? "视频通话" : "语音通话")
        updateSubtitle(subtitle)
    }

    private func updateSubtitle(_ subtitle: String) {
        guard subtitleLabel.text != subtitle else { return }
        subtitleAnimator?.stopAnimation(true)
        subtitleLabel.layer.removeAllAnimations()
        subtitleLabel.text = subtitle
        let hasSubtitle = !subtitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        subtitleLabel.isHidden = !hasSubtitle
        subtitleMinimumHeight?.isActive = hasSubtitle
        guard hasSubtitle else {
            subtitleLabel.alpha = 0
            subtitleLabel.transform = .identity
            return
        }
        subtitleLabel.alpha = 0
        subtitleLabel.transform = CGAffineTransform(
            translationX: 0,
            y: 8
        )
        let animator = UIViewPropertyAnimator(
            duration: 0.3,
            controlPoint1: CGPoint(x: 0.25, y: 0.1),
            controlPoint2: CGPoint(x: 0.25, y: 1)
        ) {
            self.subtitleLabel.alpha = 1
            self.subtitleLabel.transform = .identity
        }
        subtitleAnimator = animator
        animator.startAnimation()
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
        subtitleLabel.font = .systemFont(ofSize: 14, weight: .medium)
        subtitleLabel.textColor = .white
        subtitleLabel.textAlignment = .center
        subtitleLabel.numberOfLines = 4
        subtitleLabel.adjustsFontSizeToFitWidth = true
        subtitleLabel.minimumScaleFactor = 0.72
        subtitleLabel.isHidden = true

        [nameLabel, stateLabel, subtitleLabel].forEach { label in
            label.layer.shadowColor = UIColor.black.cgColor
            label.layer.shadowOpacity = 0.72
            label.layer.shadowRadius = 2.5
            label.layer.shadowOffset = CGSize(width: 0, height: 1)
        }

        let stack = UIStackView(arrangedSubviews: [nameLabel, stateLabel, subtitleLabel])
        stack.axis = .vertical
        stack.alignment = .fill
        stack.spacing = 3
        stack.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(stack)
        nameLabel.setContentHuggingPriority(.required, for: .vertical)
        stateLabel.setContentHuggingPriority(.required, for: .vertical)
        let subtitleHeight = subtitleLabel.heightAnchor.constraint(greaterThanOrEqualToConstant: 56)
        subtitleMinimumHeight = subtitleHeight
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),
            stack.topAnchor.constraint(equalTo: root.topAnchor, constant: 10),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: root.bottomAnchor, constant: -8)
        ])
    }
}
