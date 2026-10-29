# Reused official Taro template

The configuration, React application and page skeleton are adapted from the default template in `@tarojs/cli@4.3.1`, maintained in https://github.com/NervJS/taro. Source archive: `tarojs-cli-4.3.1.tgz`, integrity `sha512-Ou6IsFKY8QHG7okbxuHN/tQ0hKtyP/EPXy0KAO8BhJO+M+FA5Y5mh+A1HuuDbOJV89PtLtBDK5/eKCm5Hvqwsw==`.

Original paths: `templates/default/config/index.js`, `babel.config.js`, `src/app.js`, `src/app.config.js`, `src/pages/index/index.jsx`, `package.json.tmpl`, `tsconfig.json`. Adaptations remove unused platform targets, CSS preprocessors, generator and Git hooks; add strict type checking and an isolated synthetic page. No Taro runtime/compiler implementation is copied or reimplemented.

## MIT License

Copyright (c) 2018 O2Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Installed dependencies retain their own license files. This notice covers the adapted template, not a claim that all transitive licenses or production distribution obligations have been fully audited.
