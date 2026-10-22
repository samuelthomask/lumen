// Lumen: přepínač velikosti náhledů (málo velkých / střední / hodně malých) s minimalistickými ikonami.

const React = require('react');
const classnames = require('classnames');
const { useDensity } = require('stremio/common/density');
const { useLumenText } = require('stremio/common/lumenText');

// ikony ukazují, kolik náhledů je vidět: l = 2 velké, m = 2×2, s = 3×3
const OPTIONS = [
    {
        value: 'l',
        titleKey: 'densityLarge',
        cells: [[2, 3, 7, 7], [11, 3, 7, 7]]
    },
    {
        value: 'm',
        titleKey: 'densityMedium',
        cells: [[3, 3, 5, 5], [10, 3, 5, 5], [3, 10, 5, 5], [10, 10, 5, 5]]
    },
    {
        value: 's',
        titleKey: 'densitySmall',
        cells: [3, 8, 13].flatMap((x) => [3, 8, 13].map((y) => [x, y, 3, 3]))
    }
];

const DensityControl = () => {
    const [density, setDensity] = useDensity();
    const lt = useLumenText();
    return (
        <div className={'lumen-density'} role={'group'} aria-label={lt('previewSize')}>
            {
                OPTIONS.map(({ value, titleKey, cells }) => (
                    <button
                        key={value}
                        type={'button'}
                        tabIndex={-1}
                        title={lt(titleKey)}
                        aria-pressed={density === value}
                        className={classnames('lumen-density-button', { 'selected': density === value })}
                        onClick={() => setDensity(value)}
                    >
                        <svg viewBox={'0 0 20 20'} width={'20'} height={'20'} fill={'currentColor'} aria-hidden={'true'}>
                            {cells.map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} rx={w > 5 ? 1.6 : 1} />)}
                        </svg>
                    </button>
                ))
            }
        </div>
    );
};

module.exports = DensityControl;
