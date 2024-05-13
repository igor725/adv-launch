# psOff advanced launcher

This is a launcher for [psOff, PlayStation 4 emulator](https://github.com/SysRay/psOff_public/) written in JS using Electron framework.

<details>
  <summary>Screenshots</summary>

  ![screen1](/misc/screen1.png)
  ![screen1](/misc/screen2.png)
  ![screen1](/misc/screen3.png)

</details>

## Features
+ Multiple game directories support with deep scaning
+ Automatic updates for emulator releases and nightly builds
+ List filtering by title name/id
+ Game's background music
+ Trophies system

## Planned features
+ Controllers/Keybind cofiguration
+ Gamepad control support
+ Audio device selection
+ Custom themes

## How can I download it?

Glad you asked! Just hit the [Actions](<https://github.com/igor725/adv-launch/actions?query=branch%3Amain>) button and download the latest available build.

## Contributing

Every contribution are welcome! The launcher's code is not the cleanest in the world but it's manageable.
Some parts are hacky as hell and will be reworked later (probably).

## Other languages

This launcher supports multiple languages. The language of displaying text depends on emulator's language settings. If selected langauge is not available, then it will fallback to English.

### What should I do to add support for my language?

Well, first of all you should go to `webroot/langs/`, clone `en.json` and rename it to your short language code. Now you can update the file contents and translate these strings to your language. When translation is done, open `js/lang.js` and look for `avail_langs` array, find the line with corresponding to your language name comment and change the `null` value to the actual short language code. Now you can test your changes and open some [PR](<https://github.com/igor725/adv-launch/pulls>) if everything's ok :)

### I don't see my language name in avail_langs comments, what should I do?

Sadly, nothing. This is impossible to add new language since we stick to [PS4 supported languages list](<https://www.psdevwiki.com/ps4/Languages>).

## LICENSE

The launcher released under MIT license, but some its parts are licensed under other licenses, see `bin/*-license.txt` for more info.
