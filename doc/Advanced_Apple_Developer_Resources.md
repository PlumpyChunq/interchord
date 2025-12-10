# Advanced Apple Developer Resources

> **Last Updated:** December 2025 | **Related:** `APPLE_DEV_PERSONA.md`

## How to Use This List

1. **Quick reference** – Jump to a section when you need a specific link
2. **Learning path** – Follow the "Suggested Reading Path" at the bottom for structured learning
3. **Stay current** – Check "Newsletters" monthly for what's new

**Sections:** [Official](#official-apple-resources) | [Community](#community-resources) | [Liquid Glass & visionOS](#liquid-glass--visionos) | [Tools](#tools) | [Reading Path](#suggested-reading-path)

---

## Official Apple Resources

### Documentation

| Resource | URL | Use For |
|----------|-----|---------|
| **Apple Developer Docs** | [developer.apple.com/documentation](https://developer.apple.com/documentation) | API reference, guides, sample code |
| **Swift Programming Language (TSPL)** | [docs.swift.org/swift-book](https://docs.swift.org/swift-book/) | Language reference (Swift 6) |
| **Human Interface Guidelines** | [developer.apple.com/design/human-interface-guidelines](https://developer.apple.com/design/human-interface-guidelines) | UI/UX patterns, accessibility |
| **SwiftUI Tutorials** | [developer.apple.com/tutorials/swiftui](https://developer.apple.com/tutorials/swiftui) | Hands-on SwiftUI learning |

### Video & Forums

| Resource | URL | Use For |
|----------|-----|---------|
| **WWDC Videos** | [developer.apple.com/videos](https://developer.apple.com/videos) | New APIs, deep dives |
| **Developer Forums** | [developer.apple.com/forums](https://developer.apple.com/forums) | Q&A with Apple engineers |
| **Sample Code** | [developer.apple.com/sample-code](https://developer.apple.com/sample-code) | Working examples |

---

## Community Resources

### Courses & Tutorials

| Resource | URL | Level |
|----------|-----|-------|
| **Stanford CS193p** | [cs193p.stanford.edu](https://cs193p.stanford.edu/) | Intermediate |
| **Hacking with Swift** | [hackingwithswift.com](https://www.hackingwithswift.com/) | Beginner → Advanced |
| **Kodeco** | [kodeco.com/ios/paths](https://www.kodeco.com/ios/paths/learn) | All levels |
| **Swift by Sundell** | [swiftbysundell.com](https://www.swiftbysundell.com/) | Intermediate → Advanced |

### Newsletters (Subscribe to Stay Current)

| Newsletter | URL | Frequency |
|------------|-----|-----------|
| **iOS Dev Weekly** | [iosdevweekly.com](https://iosdevweekly.com/) | Weekly |
| **SwiftLee** | [avanderlee.com](https://www.avanderlee.com/) | Weekly |
| **Swift with Majid** | [swiftwithmajid.com](https://swiftwithmajid.com/) | Weekly |

### YouTube

- **Sean Allen** – Architecture, career advice
- **Paul Hudson** – WWDC recaps, tutorials
- **Point-Free** – Functional Swift, Composable Architecture

### GitHub

| Repository | URL | Type |
|------------|-----|------|
| **awesome-swiftui** | [github.com/vlondon/awesome-swiftui](https://github.com/vlondon/awesome-swiftui) | Curated list |
| **Composable Architecture** | [github.com/pointfreeco/swift-composable-architecture](https://github.com/pointfreeco/swift-composable-architecture) | Architecture framework |
| **Swift Forums** | [forums.swift.org](https://forums.swift.org/) | Language discussions |

---

## Liquid Glass & visionOS

### Liquid Glass (iOS 26+)

Apple's unified translucent design language across iOS, iPadOS, macOS, and visionOS. Use `Material` modifiers in SwiftUI.

- **WWDC25:** "Meet Liquid Glass" session
- **Docs:** [developer.apple.com/design](https://developer.apple.com/design/) (Design hub)

### visionOS / Vision Pro

| Resource | URL |
|----------|-----|
| **Official Dev Hub** | [developer.apple.com/visionos](https://developer.apple.com/visionos/) |
| **visionOS HIG** | [developer.apple.com/design/human-interface-guidelines/designing-for-visionos](https://developer.apple.com/design/human-interface-guidelines/designing-for-visionos) |
| **awesome-visionos** | [github.com/sindresorhus/awesome-visionos](https://github.com/sindresorhus/awesome-visionos) |

---

## Tools

| Tool | Use For |
|------|---------|
| **Xcode 16+** | Primary IDE, Previews, Instruments |
| **Swift Playgrounds** | Rapid prototyping ([apple.com/swift/playgrounds](https://www.apple.com/swift/playgrounds/)) |
| **Instruments** | Performance profiling (Time Profiler, SwiftUI updates, Memory) |
| **Accessibility Inspector** | VoiceOver/accessibility validation |

### Key APIs (2025)

| API | Notes |
|-----|-------|
| Swift Concurrency | `async`/`await`, `Task`, `Actor` |
| SwiftData | Modern persistence (replaces Core Data for new projects) |
| Observation | `@Observable` macro (replaces `@StateObject` patterns) |
| Metal / RealityKit | Graphics, AR/VR |
| Core ML | On-device machine learning |

---

## Suggested Reading Path

**For someone new to the Apple ecosystem:**

1. **Swift Fundamentals** → TSPL: generics, protocols, concurrency
2. **SwiftUI Basics** → Apple's SwiftUI Tutorials
3. **Architecture** → Kodeco or Hacking with Swift MVVM guides
4. **Design** → HIG for your target platform
5. **Stay Current** → iOS Dev Weekly subscription

**For InterChord native app specifically:**

1. Review `NATIVE_APP_CONVERSION_PLAN.md`
2. Study SpriteKit physics for graph visualization
3. Read SwiftData documentation for caching strategy
