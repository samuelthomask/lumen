// Lumen: náhrada výběru přehrávače ze stremio-video (webpack ji podstrčí místo ./selectVideoImplementation).
// Na Android TV neběží streamovací server a vrstva withStreamingServer by bez něj každý stream odmítla
// („Stream is not supported“). Tam proto přímý HTTP odkaz posíláme rovnou do přehrávače v obalu.
// Torrenty (infoHash, magnet) bez serveru přehrát nejde, ty dál skončí chybou.

const original = require('@stremio/stremio-video/src/StremioVideo/selectVideoImplementation');
const ShellVideo = require('@stremio/stremio-video/src/ShellVideo');
const withHTMLSubtitles = require('@stremio/stremio-video/src/withHTMLSubtitles');

// stejná třída pro všechna načtení, jinak by se přehrávač při každém streamu zbytečně znovu vytvářel
const DirectShellVideo = withHTMLSubtitles(ShellVideo);

const selectVideoImplementation = (commandArgs, options) => {
    const stream = commandArgs && commandArgs.stream;
    if (
        typeof window !== 'undefined' && window.__lumenTV === true &&
        options && options.shellTransport &&
        typeof commandArgs.streamingServerURL !== 'string' &&
        stream && typeof stream.url === 'string' && !stream.url.startsWith('magnet:') &&
        typeof stream.externalUrl !== 'string' && typeof stream.ytId !== 'string'
    ) {
        return DirectShellVideo;
    }
    return original(commandArgs, options);
};

module.exports = selectVideoImplementation;
