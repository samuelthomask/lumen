// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { useTranslation } = require('react-i18next');
const NavTabButton = require('./NavTabButton');
const { languageOf } = require('stremio/common/lumenText');
const styles = require('./styles');

const VerticalNavBar = React.memo(React.forwardRef(({ className, selected, tabs }, ref) => {
    const { t, i18n } = useTranslation();
    return (
        <nav ref={ref} className={classnames(className, styles['vertical-nav-bar-container'])}>
            {
                Array.isArray(tabs) ?
                    tabs.map((tab, index) => (
                        <NavTabButton
                            key={index}
                            className={styles['nav-tab-button']}
                            selected={tab.id === selected}
                            href={tab.href}
                            logo={tab.logo}
                            icon={tab.icon}
                            label={tab.id === 'help' ? (languageOf(i18n.language) === 'cs' ? 'Nápověda' : 'Help') : t(tab.label)}
                            onClick={tab.onClick}
                        />
                    ))
                    :
                    null
            }
        </nav>
    );
}));

VerticalNavBar.displayName = 'VerticalNavBar';

VerticalNavBar.propTypes = {
    className: PropTypes.string,
    selected: PropTypes.string,
    tabs: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string,
        label: PropTypes.string,
        logo: PropTypes.string,
        icon: PropTypes.string,
        href: PropTypes.string,
        onClick: PropTypes.func
    }))
};

module.exports = VerticalNavBar;
