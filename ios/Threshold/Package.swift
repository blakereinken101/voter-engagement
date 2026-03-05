// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Threshold",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "Threshold", targets: ["Threshold"]),
    ],
    targets: [
        .target(
            name: "Threshold",
            path: "Threshold"
        ),
    ]
)
