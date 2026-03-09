import { html } from 'lit'
import { customElement } from 'lit/decorators.js'
import { MarkeeElement, extend } from '@markee/runtime'

import './no-files.css'

@customElement('markee-no-files')
export class MarkeeNoFiles extends MarkeeElement {
  render() {
    return html`
      <div id="blobs">
        <div></div>
        <div></div>
      </div>
      <main>
        <h1>No file found</h1>

        <p>
          Your website is empty! That's alright; most likely you've just initialized a
          new Markee project.
        </p>

        <h2>1. Create a configuration file</h2>
        <p>
          You can configure your Markee website through a
          <code>markee.yaml</code> or <code>markee.yml</code> configuration file.
        </p>

        <h2>2. Add your sources</h2>
        <p>
          Markee needs to know where to find your source Markdown files. This is done
          by declaring source "roots": subfolders of your project containing your
          files. You declare them in your configuration file.
        </p>
        <p>
          Each source needs to map to a folder on your filesystem. By default it will
          mount on the equivalent path in your Markee website (i.e. a
          <code>docs</code> folder will be mounted on the <code>/docs</code>
          path). You can optionally set a different mount point by specifying a
          <code>mount</code> option for your source.
        </p>

        <p>Here is a sample configuration:</p>
        <pre
          class="language-yaml"
          data-prismjs-copy=""
          data-prismjs-copy-success=""
          data-prismjs-copy-error=""
          data-prismjs-copy-timeout="1000"
        ><code>sources:
      - root: 'pages'
        mount: '/'
      - root: 'docs'</code></pre>

        <p>
          For more options, refer to
          <a href="https://markee.dev/" rel="noopener noreferrer" target="_blank">
            Markee's documentation
          </a>
          .
        </p>
      </main>
    `
  }

  updated() {
    void extend.prism.loadLanguage('yaml')
  }
}
