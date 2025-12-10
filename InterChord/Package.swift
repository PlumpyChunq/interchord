// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "InterChord",
    platforms: [
        .macOS(.v14),
        .iOS(.v17)
    ],
    products: [
        .library(
            name: "InterChord",
            targets: ["InterChord"]
        ),
    ],
    dependencies: [
        // No external dependencies for Phase 1
    ],
    targets: [
        .target(
            name: "InterChord",
            dependencies: [],
            path: "InterChord",
            swiftSettings: [
                .enableExperimentalFeature("StrictConcurrency")
            ]
        ),
        .testTarget(
            name: "InterChordTests",
            dependencies: ["InterChord"],
            path: "InterChordTests"
        ),
    ]
)
