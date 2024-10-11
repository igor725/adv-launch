# psOff advanced launcher

> [!WARNING]
> This launcher will never be updated again!
> Since psOff_public is now archive repo, there's no need
> in this launcher. Ray and me now working on emulator
> privately. We're in the middle of complete rework as of
> Oct. 11th. The new emulator requires no launcher, since
> user interface is integrated in emulator itself.
> Learn more [here](https://github.com/SysRay/psOff_compatibility/).

This is a launcher for [psOff, PlayStation 4 emulator](https://github.com/SysRay/psOff_public/) written in JS using Electron framework.

<details>
  <summary>Screenshots</summary>

  ![screen1](/misc/screen1.png)
  ![screen2](/misc/screen2.png)
  ![screen3](/misc/screen3.png)
  ![screen4](/misc/screen4.png)
  ![screen5](/misc/screen5.png)

</details>

## Features
+ Multiple game directories support with deep scaning
+ Automatic updates for emulator releases and nightly builds
+ List filtering by title name/id
+ Game's background music
+ Trophies system
+ Controllers/Keybind cofiguration
+ Audio device selection

## Planned features
+ Gamepad control support
+ Custom themes

## System requirements

> [!WARNING]
> Please keep in mind that these requirements for the Launcher only!
> You're supposed to add up the Launcher RAM+VRAM requirements
> to the emulator ones to get the actual recommended values.

Recommended:
* OS: >= Windows 10
* CPU: 1.4GHz, SSE3 capable
* GPU: 512MB VRAM, DirectX 11 capable
* RAM: 1.2GB

> [!NOTE]
> RAM requirement depends on the size of your game library!
> The recommended RAM size above assumes that you have
> at least ~500 PS4 titles in your possesion.
> The Launcher keeps in memory all the icons for your games
> and trophy information (if available) for currently
> selected game.

## How can I download it?

Glad you asked! Just hit the [Actions](<https://github.com/igor725/adv-launch/actions?query=branch%3Amain>) button and download the latest available build.

## Contributing

Every contribution are welcome! The launcher's code is not the cleanest in the world but it's manageable.
Some parts are hacky as hell and will be reworked later (probably).

## Other languages

This launcher supports multiple languages. The language of displaying text depends on emulator's language settings. If selected langauge is not available, then it will fallback to English.

### What should I do to add support for my language?

Well, first of all you should go to `webroot/langs/`, clone `en.json` and rename it to your short language code. Now you can update the file contents and translate these strings to your language. When translation is done, open `webroot/js/lang.js` and look for `avail_langs` array, find the line with corresponding to your language name comment and change the `null` value to the actual short language code. Now you can test your changes and open some [PR](<https://github.com/igor725/adv-launch/pulls>) if everything's ok :)

### I don't see my language name in avail_langs comments, what should I do?

Sadly, nothing. This is impossible to add new language since we stick to [PS4 supported languages list](<https://www.psdevwiki.com/ps4/Languages>).

## LICENSE

The launcher released under MIT license, but some its parts are licensed under other licenses, see `webroot/3rd_license/*-license.txt` for more info.
