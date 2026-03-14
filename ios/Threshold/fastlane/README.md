fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios load_asc_api_key

```sh
[bundle exec] fastlane ios load_asc_api_key
```

Load App Store Connect API key from environment

### ios fetch_certs

```sh
[bundle exec] fastlane ios fetch_certs
```

Fetch signing certificates and provisioning profiles

### ios setup_match

```sh
[bundle exec] fastlane ios setup_match
```

One-time setup: generate certs and profiles (run locally)

### ios increment_build

```sh
[bundle exec] fastlane ios increment_build
```

Increment build number based on latest TestFlight build

### ios beta

```sh
[bundle exec] fastlane ios beta
```

Build and upload to TestFlight

### ios release

```sh
[bundle exec] fastlane ios release
```

Build and upload to App Store

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
