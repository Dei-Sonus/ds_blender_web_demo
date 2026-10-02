# Third-party notices

Software and assets bundled into the shipped plugin, beyond the vendored JUCE
Framework under `plugin/JUCE`. This list is also shown in-app: click the
version label in the footer to open the Licenses sheet
(`webview/src/app/models/third-party-license.model.ts` is the same table in
code — keep the two in sync when a dependency changes).

| Component | License | Notes |
| --- | --- | --- |
| [JUCE Framework](https://juce.com) | AGPLv3 / Commercial | The native framework this plugin is built on |
| [Angular](https://angular.dev) (`@angular/cdk`, `common`, `compiler`, `core`, `forms`, `material`, `platform-browser`, `router`) | MIT | Google LLC |
| [RxJS](https://rxjs.dev) | Apache-2.0 | |
| [three.js](https://threejs.org) | MIT | |
| [Zone.js](https://github.com/angular/angular/tree/main/packages/zone.js) | MIT | |
| [tslib](https://github.com/microsoft/tslib) | 0BSD | Microsoft Corporation |
| [Material Icons](https://fonts.google.com/icons) | Apache-2.0 | Google |
| [Font Awesome Free](https://fontawesome.com) | CC BY 4.0 | The Guitar and Drums track-tag icons (`webview/src/app/icons/custom-track-tag-icons.ts`) |
| [Roboto](https://fonts.google.com/specimen/Roboto) | OFL-1.1 | Google Fonts, via `@fontsource/roboto` |

Font Awesome Free icons are licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Copyright Fonticons, Inc.

JUCE Framework modules are dual-licensed under
[AGPLv3](https://www.gnu.org/licenses/agpl-3.0.en.html) and the
[commercial JUCE licence](https://juce.com/legal/juce-8-licence/); see
`plugin/JUCE/LICENSE.md`.

## Browser demo

The browser demo (`web-demo/`, built into `BlenderWebDemo.zip`) additionally
bundles [PFFFT](https://bitbucket.org/jpommier/pffft) as its FFT
(`web-demo/engine/third_party/pffft`), under the FFTPACK licence below, and
[libFLAC](https://xiph.org/flac/) (the copy JUCE carries in
`juce_audio_formats/codecs/flac`) to decode the loops compiled into its
engine, under the BSD licence after it. The demo's Licenses sheet lists both.

```
Copyright (c) 2013  Julien Pommier ( pommier@modartt.com )

Based on original fortran 77 code from FFTPACKv4 from NETLIB
(http://www.netlib.org/fftpack), authored by Dr Paul Swarztrauber
of NCAR, in 1985.

As confirmed by the NCAR fftpack software curators, the following
FFTPACKv5 license applies to FFTPACKv4 sources. My changes are
released under the same terms.

FFTPACK license:

http://www.cisl.ucar.edu/css/software/fftpack5/ftpk.html

Copyright (c) 2004 the University Corporation for Atmospheric
Research ("UCAR"). All rights reserved. Developed by NCAR's
Computational and Information Systems Laboratory, UCAR,
www.cisl.ucar.edu.

Redistribution and use of the Software in source and binary forms,
with or without modification, is permitted provided that the
following conditions are met:

- Neither the names of NCAR's Computational and Information Systems
Laboratory, the University Corporation for Atmospheric Research,
nor the names of its sponsors or contributors may be used to
endorse or promote products derived from this Software without
specific prior written permission.

- Redistributions of source code must retain the above copyright
notices, this list of conditions, and the disclaimer below.

- Redistributions in binary form must reproduce the above copyright
notice, this list of conditions, and the disclaimer below in the
documentation and/or other materials provided with the
distribution.

THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE CONTRIBUTORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES OR OTHER LIABILITY, WHETHER IN AN
ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS WITH THE
SOFTWARE.
```

```
libFLAC - Free Lossless Audio Codec library
Copyright (C) 2000-2009  Josh Coalson
Copyright (C) 2011-2023  Xiph.Org Foundation

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:

- Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.

- Redistributions in binary form must reproduce the above copyright
notice, this list of conditions and the following disclaimer in the
documentation and/or other materials provided with the distribution.

- Neither the name of the Xiph.Org Foundation nor the names of its
contributors may be used to endorse or promote products derived from
this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE FOUNDATION OR
CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```
