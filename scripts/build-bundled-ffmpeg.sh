#!/usr/bin/env bash
set -euo pipefail

platform="${1:-}"
architecture="${2:-}"
if [[ ! "$platform" =~ ^(mac|win|linux)$ || ! "$architecture" =~ ^(x64|arm64)$ ]]; then
  echo "Usage: scripts/build-bundled-ffmpeg.sh <mac|win|linux> <x64|arm64>" >&2
  exit 1
fi

version="7.1.1"
bundle_revision="4"
source_sha256="733984395e0dbbe5c046abda2dc49a5544e7e0e1e2366bba849222ae9e3a03b1"
source_url="https://ffmpeg.org/releases/ffmpeg-${version}.tar.xz"
package_directory="$(cd "$(dirname "$0")/.." && pwd)"
bundle_directory="${STREAMSHARE_FFMPEG_BUNDLE_DIR:-$package_directory/.ffmpeg-cache/$version-r$bundle_revision/$platform-$architecture}"
completion_marker="$bundle_directory/.complete"
executable_suffix=""
[[ "$platform" == "win" ]] && executable_suffix=".exe"
libplacebo_version=""
libplacebo_package=""

if [[ -x "$bundle_directory/ffmpeg$executable_suffix" && -x "$bundle_directory/ffprobe$executable_suffix" && -f "$completion_marker" ]]; then
  echo "Using cached FFmpeg $version bundle from $bundle_directory"
  exit 0
fi

temporary_root="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
if [[ "$platform" == "win" ]] && command -v cygpath >/dev/null 2>&1; then
  temporary_root="$(cygpath -u "$temporary_root")"
fi
work_root="$temporary_root/streamshare-ffmpeg-$platform-$architecture"
source_archive="$work_root/ffmpeg-$version.tar.xz"
source_directory="$work_root/source"
install_directory="$work_root/install"
if [[ -z "$bundle_directory" || "$bundle_directory" == "/" ]]; then
  echo "Refusing unsafe FFmpeg bundle directory: $bundle_directory" >&2
  exit 1
fi
rm -rf "$work_root"
rm -rf "$bundle_directory"
mkdir -p "$source_directory" "$install_directory" "$bundle_directory"
curl --fail --silent --show-error --location \
  --retry 5 --retry-all-errors --retry-delay 2 \
  "$source_url" --output "$source_archive"

if command -v shasum >/dev/null 2>&1; then
  actual_sha256="$(shasum -a 256 < "$source_archive" | awk '{print $1}')"
else
  actual_sha256="$(sha256sum < "$source_archive" | awk '{print $1}')"
fi
if [[ "$actual_sha256" != "$source_sha256" ]]; then
  echo "Unexpected FFmpeg source SHA-256: $actual_sha256" >&2
  exit 1
fi

tar -xf "$source_archive" -C "$source_directory" --strip-components=1
cd "$source_directory"

configure_options=(
  "--prefix=$install_directory"
  --disable-autodetect
  --disable-doc
  --disable-debug
  --disable-ffplay
  --disable-avdevice
  --disable-shared
  --enable-static
  --enable-small
)
case "$platform" in
  mac)
    for command_name in brew pkg-config otool install_name_tool codesign lipo; do
      if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "macOS bundles require $command_name." >&2
        exit 1
      fi
    done
    if ! pkg-config --atleast-version=6.338.0 libplacebo; then
      echo "macOS bundles require libplacebo 6.338.0 or later (brew install libplacebo molten-vk)." >&2
      exit 1
    fi
    molten_vk_prefix="$(brew --prefix molten-vk)"
    molten_vk_library="$molten_vk_prefix/lib/libMoltenVK.dylib"
    if [[ ! -f "$molten_vk_library" ]]; then
      echo "macOS bundles require MoltenVK (brew install molten-vk)." >&2
      exit 1
    fi
    molten_vk_library="$(cd "$(dirname "$molten_vk_library")" && pwd -P)/$(basename "$molten_vk_library")"
    libplacebo_library="$(pkg-config --variable=libdir libplacebo)/libplacebo.dylib"
    required_macos_architecture="$([[ "$architecture" == "x64" ]] && echo x86_64 || echo arm64)"
    for dependency_library in "$libplacebo_library" "$molten_vk_library"; do
      if [[ ! " $(lipo -archs "$dependency_library") " == *" $required_macos_architecture "* ]]; then
        echo "$(basename "$dependency_library") does not contain $required_macos_architecture. Use a native Homebrew installation for the target architecture." >&2
        exit 1
      fi
    done
    libplacebo_version="$(pkg-config --modversion libplacebo)"
    libplacebo_package="$(brew list --versions libplacebo)"
    configure_options+=(
      --enable-securetransport
      --enable-videotoolbox
      --enable-version3
      --enable-vulkan
      --enable-libplacebo
      "--arch=$([[ "$architecture" == "x64" ]] && echo x86_64 || echo arm64)"
      "--extra-cflags=-arch $([[ "$architecture" == "x64" ]] && echo x86_64 || echo arm64)"
      "--extra-ldflags=-arch $([[ "$architecture" == "x64" ]] && echo x86_64 || echo arm64)"
    )
    ;;
  win)
    if ! pkg-config --atleast-version=6.338.0 libplacebo; then
      echo "Windows bundles require libplacebo 6.338.0 or later." >&2
      exit 1
    fi
    for command_name in ldd pacman; do
      if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Windows bundles require $command_name from MSYS2." >&2
        exit 1
      fi
    done
    libplacebo_version="$(pkg-config --modversion libplacebo)"
    libplacebo_package="$(pacman -Q mingw-w64-ucrt-x86_64-libplacebo)"
    configure_options+=(
      --enable-schannel
      --enable-mediafoundation
      --enable-version3
      --enable-vulkan
      --enable-libplacebo
      --target-os=mingw32
      --arch=x86_64
    )
    ;;
  linux) configure_options+=(--enable-openssl --enable-version3 --pkg-config-flags=--static --extra-ldflags=-static) ;;
esac

./configure "${configure_options[@]}"
jobs="$(getconf _NPROCESSORS_ONLN 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 2)"
make -j"$jobs" "ffmpeg$executable_suffix" "ffprobe$executable_suffix"

cp "ffmpeg$executable_suffix" "$bundle_directory/ffmpeg$executable_suffix"
cp "ffprobe$executable_suffix" "$bundle_directory/ffprobe$executable_suffix"
chmod 755 "$bundle_directory/ffmpeg$executable_suffix" "$bundle_directory/ffprobe$executable_suffix"
cp COPYING.LGPLv2.1 COPYING.LGPLv3 LICENSE.md "$bundle_directory/"
if [[ "$platform" == "mac" ]]; then
  runtime_license_directory="$bundle_directory/THIRD_PARTY_LICENSES"
  runtime_manifest="$bundle_directory/RUNTIME_COMPONENTS.txt"
  build_manifest="$bundle_directory/BUILD_COMPONENTS.txt"
  mkdir -p "$runtime_license_directory"
  : > "$runtime_manifest"
  : > "$build_manifest"

  brew_prefix="$(brew --prefix)"
  copied_runtime_names=()
  copied_runtime_paths=()
  recorded_runtime_packages="|"
  runtime_sources=(
    "$bundle_directory/ffmpeg"
    "$bundle_directory/ffprobe"
    "$molten_vk_library"
  )
  runtime_targets=(
    "$bundle_directory/ffmpeg"
    "$bundle_directory/ffprobe"
  )

  macos_runtime_path() {
    local requested_name="$1"
    local index=0
    while [[ "$index" -lt "${#copied_runtime_names[@]}" ]]; do
      if [[ "${copied_runtime_names[$index]}" == "$requested_name" ]]; then
        printf '%s\n' "${copied_runtime_paths[$index]}"
        return 0
      fi
      index=$((index + 1))
    done
    return 1
  }

  macos_package_recorded() {
    local requested_name="$1"
    [[ "$recorded_runtime_packages" == *"|$requested_name|"* ]]
  }

  resolve_macos_dependency() {
    local dependency="$1"
    local owner="$2"
    local candidate=""
    case "$dependency" in
      /System/*|/usr/lib/*) return 1 ;;
      @loader_path/*)
        candidate="$(dirname "$owner")/${dependency#@loader_path/}"
        ;;
      @rpath/*|@executable_path/*)
        local dependency_name="${dependency##*/}"
        local possible_matches=("$(dirname "$owner")/$dependency_name" "$brew_prefix"/opt/*/lib/"$dependency_name")
        for possible_match in "${possible_matches[@]}"; do
          if [[ -f "$possible_match" ]]; then
            candidate="$possible_match"
            break
          fi
        done
        ;;
      /*) candidate="$dependency" ;;
      *) return 1 ;;
    esac
    [[ -f "$candidate" ]] || return 1
    local candidate_directory
    candidate_directory="$(cd "$(dirname "$candidate")" && pwd -P)"
    printf '%s/%s\n' "$candidate_directory" "$(basename "$candidate")"
  }

  record_macos_package() {
    local dependency="$1"
    local cellar_marker="/Cellar/"
    [[ "$dependency" == *"$cellar_marker"* ]] || return 0
    local relative="${dependency#*${cellar_marker}}"
    local package_name="${relative%%/*}"
    local remaining="${relative#*/}"
    local package_version="${remaining%%/*}"
    [[ -n "$package_name" && -n "$package_version" ]] || return 0
    macos_package_recorded "$package_name" && return 0
    recorded_runtime_packages="${recorded_runtime_packages}${package_name}|"
    local package_json package_license package_homepage
    package_json="$(brew info --json=v2 "$package_name")"
    package_license="$(node -e 'const value=JSON.parse(process.argv[1]).formulae[0]; process.stdout.write(value.license || "unknown")' "$package_json")"
    package_homepage="$(node -e 'const value=JSON.parse(process.argv[1]).formulae[0]; process.stdout.write(value.homepage || "")' "$package_json")"
    printf '%s\t%s\t%s\t%s\n' "$package_name" "$package_version" "$package_license" "$package_homepage" >> "$runtime_manifest"
    local package_prefix="${dependency%%/${package_name}/${package_version}/*}/${package_name}/${package_version}"
    mkdir -p "$runtime_license_directory/$package_name"
    {
      echo "Package: $package_name"
      echo "Version: $package_version"
      echo "SPDX license: $package_license"
      echo "Homepage: $package_homepage"
      echo "Installed from the official Homebrew formula and dynamically linked so it can be replaced."
    } > "$runtime_license_directory/$package_name/LICENSE_METADATA.txt"
    local copied_license=false
    while IFS= read -r license_file; do
      cp "$license_file" "$runtime_license_directory/$package_name/$(basename "$license_file")"
      copied_license=true
    done < <(find "$package_prefix" -maxdepth 2 -type f \( \
      -iname 'LICENSE*' -o -iname 'COPYING*' -o -iname 'NOTICE*' -o -iname 'COPYRIGHT*' \
    \) -print)
    if [[ "$copied_license" != true ]]; then
      echo "No license text found in Homebrew package $package_name $package_version" >&2
      exit 1
    fi
  }

  queue_index=0
  while [[ "$queue_index" -lt "${#runtime_sources[@]}" ]]; do
    runtime_source="${runtime_sources[$queue_index]}"
    queue_index=$((queue_index + 1))
    if [[ "$runtime_source" != "$bundle_directory/ffmpeg" && "$runtime_source" != "$bundle_directory/ffprobe" ]]; then
      runtime_name="$(basename "$runtime_source")"
      copied_runtime_path="$(macos_runtime_path "$runtime_name" || true)"
      if [[ -z "$copied_runtime_path" ]]; then
        copied_runtime_names+=("$runtime_name")
        copied_runtime_paths+=("$runtime_source")
        cp "$runtime_source" "$bundle_directory/$runtime_name"
        runtime_targets+=("$bundle_directory/$runtime_name")
        record_macos_package "$runtime_source"
      fi
    fi
    while IFS= read -r runtime_dependency; do
      resolved_dependency="$(resolve_macos_dependency "$runtime_dependency" "$runtime_source" || true)"
      [[ -n "$resolved_dependency" ]] || continue
      runtime_name="$(basename "$resolved_dependency")"
      copied_runtime_path="$(macos_runtime_path "$runtime_name" || true)"
      if [[ -n "$copied_runtime_path" && "$copied_runtime_path" != "$resolved_dependency" ]]; then
        echo "Conflicting macOS runtime libraries named $runtime_name" >&2
        exit 1
      fi
      [[ -n "$copied_runtime_path" ]] || runtime_sources+=("$resolved_dependency")
    done < <(otool -L "$runtime_source" | tail -n +2 | awk '{print $1}')
  done

  for runtime_target in "${runtime_targets[@]}"; do
    while IFS= read -r runtime_dependency; do
      resolved_dependency="$(resolve_macos_dependency "$runtime_dependency" "$runtime_target" || true)"
      [[ -n "$resolved_dependency" ]] || continue
      runtime_name="$(basename "$resolved_dependency")"
      if [[ -f "$bundle_directory/$runtime_name" ]]; then
        install_name_tool -change "$runtime_dependency" "@loader_path/$runtime_name" "$runtime_target"
      fi
    done < <(otool -L "$runtime_target" | tail -n +2 | awk '{print $1}')
    if [[ "$runtime_target" == *.dylib ]]; then
      install_name_tool -id "@loader_path/$(basename "$runtime_target")" "$runtime_target"
    fi
    codesign --force --sign - "$runtime_target"
  done

  cat > "$bundle_directory/MoltenVK_icd.json" <<'JSON'
{
  "file_format_version": "1.0.0",
  "ICD": {
    "library_path": "./libMoltenVK.dylib",
    "api_version": "1.4.0",
    "is_portability_driver": true
  }
}
JSON
  vulkan_headers_package="vulkan-headers"
  vulkan_headers_version="$(brew list --versions "$vulkan_headers_package" | awk '{print $2}')"
  vulkan_headers_json="$(brew info --json=v2 "$vulkan_headers_package")"
  vulkan_headers_license="$(node -e 'const value=JSON.parse(process.argv[1]).formulae[0]; process.stdout.write(value.license || "unknown")' "$vulkan_headers_json")"
  vulkan_headers_homepage="$(node -e 'const value=JSON.parse(process.argv[1]).formulae[0]; process.stdout.write(value.homepage || "")' "$vulkan_headers_json")"
  printf '%s\t%s\t%s\t%s\n' "$vulkan_headers_package" "$vulkan_headers_version" "$vulkan_headers_license" "$vulkan_headers_homepage" > "$build_manifest"
  vulkan_headers_prefix="$(brew --cellar "$vulkan_headers_package")/$vulkan_headers_version"
  mkdir -p "$runtime_license_directory/$vulkan_headers_package"
  {
    echo "Package: $vulkan_headers_package"
    echo "Version: $vulkan_headers_version"
    echo "SPDX license: $vulkan_headers_license"
    echo "Homepage: $vulkan_headers_homepage"
    echo "Build-time headers only; no code from this package is bundled at runtime."
  } > "$runtime_license_directory/$vulkan_headers_package/LICENSE_METADATA.txt"
  copied_vulkan_headers_license=false
  while IFS= read -r license_file; do
    cp "$license_file" "$runtime_license_directory/$vulkan_headers_package/$(basename "$license_file")"
    copied_vulkan_headers_license=true
  done < <(find "$vulkan_headers_prefix" -maxdepth 2 -type f \( \
    -iname 'LICENSE*' -o -iname 'COPYING*' -o -iname 'NOTICE*' -o -iname 'COPYRIGHT*' \
  \) -print)
  if [[ "$copied_vulkan_headers_license" != true ]]; then
    echo "No license text found in Homebrew package $vulkan_headers_package $vulkan_headers_version" >&2
    exit 1
  fi
elif [[ "$platform" == "win" ]]; then
  runtime_license_directory="$bundle_directory/THIRD_PARTY_LICENSES"
  runtime_manifest="$bundle_directory/RUNTIME_COMPONENTS.txt"
  build_manifest="$bundle_directory/BUILD_COMPONENTS.txt"
  mkdir -p "$runtime_license_directory"
  : > "$runtime_manifest"
  : > "$build_manifest"
  copy_package_licenses() {
    local package_name="$1"
    local package_license_directory="/ucrt64/share/licenses/${package_name#mingw-w64-ucrt-x86_64-}"
    if [[ ! -d "$package_license_directory" ]]; then
      echo "No license directory found for package $package_name" >&2
      exit 1
    fi
    mkdir -p "$runtime_license_directory/$package_name"
    cp -R "$package_license_directory/." "$runtime_license_directory/$package_name/"
  }
  vulkan_headers_package="mingw-w64-ucrt-x86_64-vulkan-headers"
  printf '%s\t%s\n' "$vulkan_headers_package" "$(pacman -Q "$vulkan_headers_package" | awk '{print $2}')" > "$build_manifest"
  copy_package_licenses "$vulkan_headers_package"
  declare -A copied_runtime_files=()
  for runtime_binary in "$bundle_directory/ffmpeg.exe" "$bundle_directory/ffprobe.exe"; do
    while IFS= read -r runtime_dependency; do
      [[ "$runtime_dependency" == /ucrt64/bin/*.dll ]] || continue
      runtime_name="$(basename "$runtime_dependency")"
      [[ -n "${copied_runtime_files[$runtime_name]:-}" ]] && continue
      copied_runtime_files[$runtime_name]=1
      cp "$runtime_dependency" "$bundle_directory/$runtime_name"

      runtime_package="$(pacman -Qoq "$runtime_dependency" | head -n 1)"
      runtime_version="$(pacman -Q "$runtime_package" | awk '{print $2}')"
      printf '%s\t%s\t%s\n' "$runtime_name" "$runtime_package" "$runtime_version" >> "$runtime_manifest"
      copy_package_licenses "$runtime_package"
    done < <(ldd "$runtime_binary" | awk '{print $3}')
  done
fi
{
  echo "Source: $source_url"
  echo "Source SHA-256: $source_sha256"
  echo "Platform: $platform"
  echo "Architecture: $architecture"
  echo "Bundle revision: $bundle_revision"
  if [[ -n "$libplacebo_version" ]]; then
    echo "libplacebo: $libplacebo_version"
    echo "libplacebo package: $libplacebo_package"
  fi
  echo "Configure: ./configure ${configure_options[*]}"
} > "$bundle_directory/BUILD_INFO.txt"
"$bundle_directory/ffmpeg$executable_suffix" -version > "$bundle_directory/FFMPEG_VERSION.txt"
if [[ "$platform" == "mac" ]]; then
  export VK_DRIVER_FILES="$bundle_directory/MoltenVK_icd.json"
  export VK_ICD_FILENAMES="$bundle_directory/MoltenVK_icd.json"
  filters_output="$("$bundle_directory/ffmpeg" -hide_banner -filters)"
  [[ "$filters_output" == *libplacebo* ]]
  filter_help_output="$("$bundle_directory/ffmpeg" -hide_banner -h filter=libplacebo)"
  [[ "$filter_help_output" == *apply_dolbyvision* ]]
  head -c 384 /dev/zero | "$bundle_directory/ffmpeg" \
    -hide_banner -loglevel error -f rawvideo -pixel_format yuv420p -video_size 16x16 \
    -framerate 1 -i pipe:0 -vf 'libplacebo=format=nv12:colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv:apply_dolbyvision=true' \
    -frames:v 1 -f null -
fi
touch "$completion_marker"

echo "Built redistributable FFmpeg $version bundle in $bundle_directory"
