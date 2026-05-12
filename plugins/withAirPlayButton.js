const fs = require("fs");
const path = require("path");
const { withDangerousMod, withXcodeProject } = require("@expo/config-plugins");

const AIRPLAY_BUTTON_FILE = "AirPlayButtonManager.m";

const AIRPLAY_BUTTON_SOURCE = `#import <React/RCTViewManager.h>
#import <AVKit/AVKit.h>
#import <MediaPlayer/MediaPlayer.h>

@interface AirPlayButtonManager : RCTViewManager
@end

@implementation AirPlayButtonManager

RCT_EXPORT_MODULE(AirPlayButton)

- (UIView *)view
{
  if (@available(iOS 11.0, *)) {
    AVRoutePickerView *routePicker = [AVRoutePickerView new];
    routePicker.prioritizesVideoDevices = YES;
    routePicker.tintColor = UIColor.whiteColor;
    routePicker.activeTintColor = [UIColor colorWithRed:0.506 green:0.549 blue:0.973 alpha:1.0];
    routePicker.backgroundColor = UIColor.clearColor;
    return routePicker;
  }

  MPVolumeView *volumeView = [MPVolumeView new];
  volumeView.showsVolumeSlider = NO;
  volumeView.showsRouteButton = YES;
  volumeView.tintColor = UIColor.whiteColor;
  volumeView.backgroundColor = UIColor.clearColor;
  return volumeView;
}

@end
`;

function withAirPlayButton(config) {
  config = withDangerousMod(config, [
    "ios",
    async (modConfig) => {
      const iosRoot = modConfig.modRequest.platformProjectRoot;
      fs.writeFileSync(path.join(iosRoot, AIRPLAY_BUTTON_FILE), AIRPLAY_BUTTON_SOURCE);
      return modConfig;
    },
  ]);

  config = withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    const target = project.getFirstTarget().uuid;

    if (!project.hasFile(AIRPLAY_BUTTON_FILE)) {
      project.addSourceFile(AIRPLAY_BUTTON_FILE, { target });
    }

    project.addFramework("AVKit.framework", { target, weak: false });
    project.addFramework("MediaPlayer.framework", { target, weak: false });

    return modConfig;
  });

  return config;
}

module.exports = withAirPlayButton;
