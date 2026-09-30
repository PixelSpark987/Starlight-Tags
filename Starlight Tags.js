// ==UserScript==
// @name         Starlight Tags
// @description  Groups tags into Watched, Spoiled, Hidden, and Other sections on Philomena-based boorus
// @author       PixelSpark987 - https://is.gd/PS987
// @icon         https://tantabus.ai/favicon.svg
// @namespace    http://tampermonkey.net/
// @version      2.6
// @homepage     https://github.com/PixelSpark987/Starlight-Tags
// @downloadURL  https://raw.githubusercontent.com/PixelSpark987/Starlight-Tags/refs/heads/main/Starlight%20Tags.js
// @updateURL    https://raw.githubusercontent.com/PixelSpark987/Starlight-Tags/refs/heads/main/Starlight%20Tags.js
// Main Sites
// @match        *://derpibooru.org/*
// @match        *://*.derpibooru.org/*
// @match        *://manebooru.art/*
// @match        *://*.manebooru.art/*
// @match        *://ponerpics.org/*
// @match        *://*.ponerpics.org/*
// @match        *://ponybooru.org/*
// @match        *://*.ponybooru.org/*
// @match        *://tantabus.ai/*
// @match        *://*.tantabus.ai/*
// @match        *://twibooru.org/*
// @match        *://*.twibooru.org/*
// Other Sites
// @match        *://trixiebooru.org/*
// @match        *://*.trixiebooru.org/*
// @match        *://furbooru.org/*
// @match        *://*.furbooru.org/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Minimal CSS for section spacing and sub-header layout
    const style = document.createElement('style');
    style.textContent = `
        .tm-tag-section {
            margin-bottom: 10px !important;
        }
        .tm-tag-section .block__header--sub {
            padding: 4px 10px !important;
        }
        .tm-tag-group.block__content {
            padding: 8px 10px !important;
        }
    `;
    document.head.appendChild(style);

    // Standard Philomena tag category sort hierarchy
    const categoryOrder = {
        'rating': 1,
        'origin': 2,
        'character': 3,
        'oc': 4,
        'species': 5,
        'body-type': 6,
        'content-fanmade': 7,
        'content-official': 8,
        'error': 9,
        '': 10 // Default / General tags
    };

    function createSection(id, title) {
        const section = document.createElement('div');
        section.id = id;
        section.className = 'block tm-tag-section';
        section.innerHTML = `
            <div class="block__header block__header--sub" style="font-weight: bold; font-size: 0.9em;">
                ${title}
            </div>
            <div class="tm-tag-group block__content tagsauce tag-list"></div>
        `;
        return section;
    }

    function sortTagGroup(container) {
        const tags = Array.from(container.children);
        if (tags.length <= 1) return;

        tags.sort((a, b) => {
            const catA = a.getAttribute('data-tag-category') || '';
            const catB = b.getAttribute('data-tag-category') || '';

            const orderA = categoryOrder[catA] ?? 10;
            const orderB = categoryOrder[catB] ?? 10;

            if (orderA !== orderB) {
                return orderA - orderB;
            }

            const nameA = a.getAttribute('data-tag-name') || '';
            const nameB = b.getAttribute('data-tag-name') || '';
            return nameA.localeCompare(nameB);
        });

        // Re-append in sorted order (DOM updates only if order changed)
        tags.forEach((tag, index) => {
            if (container.children[index] !== tag) {
                container.appendChild(tag);
            }
        });
    }

    function organizeTags() {
        const tagsauce = document.querySelector('.tagsauce') || document.querySelector('[id^="image_tags_and_source_"]')?.nextElementSibling;
        if (!tagsauce) return;

        const tags = Array.from(tagsauce.querySelectorAll('.tag.dropdown'));
        if (tags.length === 0) return;

        // 1. Relocate native main header bar directly above tagsauce
        const mainHeader = tagsauce.querySelector('.block__header.flex, .block__header:not(.block__header--sub)');
        if (mainHeader && mainHeader.parentElement === tagsauce) {
            tagsauce.before(mainHeader);
        }

        // 2. Remove native empty tag-list container if present inside tagsauce
        const emptyNativeContent = tagsauce.querySelectorAll(':scope > .block__content');
        emptyNativeContent.forEach(container => {
            if (!container.classList.contains('tm-tag-group')) {
                container.remove();
            }
        });

        // 3. Ensure custom tag sections exist inside tagsauce
        let watchedSection = document.getElementById('tm-watched-tags');
        let spoiledSection = document.getElementById('tm-spoiled-tags');
        let hiddenSection = document.getElementById('tm-hidden-tags');
        let unwatchedSection = document.getElementById('tm-unwatched-tags');

        if (!watchedSection) {
            watchedSection = createSection('tm-watched-tags', '- Watched Tags');
            spoiledSection = createSection('tm-spoiled-tags', '- Spoiled Tags');
            hiddenSection = createSection('tm-hidden-tags', '- Hidden Tags');
            unwatchedSection = createSection('tm-unwatched-tags', '- Other Tags');

            tagsauce.prepend(unwatchedSection);
            tagsauce.prepend(hiddenSection);
            tagsauce.prepend(spoiledSection);
            tagsauce.prepend(watchedSection);
        }

        const watchedGroup = watchedSection.querySelector('.tm-tag-group');
        const spoiledGroup = spoiledSection.querySelector('.tm-tag-group');
        const hiddenGroup = hiddenSection.querySelector('.tm-tag-group');
        const unwatchedGroup = unwatchedSection.querySelector('.tm-tag-group');

        let movedAnyTag = false;

        tags.forEach(tag => {
            const isWatched = tag.querySelector('.tag__state[title="Watched"]:not(.hidden)');
            const isSpoiled = tag.querySelector('.tag__state[title="Spoilered"]:not(.hidden), .tag__state[title="Spoiled"]:not(.hidden)');
            const isHidden = tag.querySelector('.tag__state[title="Hidden"]:not(.hidden)');

            let targetGroup = unwatchedGroup;
            if (isWatched) {
                targetGroup = watchedGroup;
            } else if (isSpoiled) {
                targetGroup = spoiledGroup;
            } else if (isHidden) {
                targetGroup = hiddenGroup;
            }

            // Only move the DOM node if it isn't already inside the target group
            if (tag.parentElement !== targetGroup) {
                targetGroup.appendChild(tag);
                movedAnyTag = true;
            }
        });

        // 4. Sort tag groups by category & alphabetical order if tags were moved or on initial build
        [watchedGroup, spoiledGroup, hiddenGroup, unwatchedGroup].forEach(sortTagGroup);

        // 5. Hide empty tag sections so they don't leave blank boxes
        [watchedSection, spoiledSection, hiddenSection, unwatchedSection].forEach(section => {
            if (section) {
                const group = section.querySelector('.tm-tag-group');
                section.style.display = (group && group.children.length > 0) ? '' : 'none';
            }
        });
    }

    // Run on initial page load
    organizeTags();

    // Listen for clicks on Watch/Unwatch/Spoiler/Hide dropdown buttons directly
    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[data-tag-action]');
        if (link) {
            let attempts = 0;
            const interval = setInterval(() => {
                organizeTags();
                attempts++;
                if (attempts >= 20) {
                    clearInterval(interval);
                }
            }, 100);
        }
    });

    // Observer setup: Watch for DOM structure AND class attribute changes
    let isProcessing = false;
    const observer = new MutationObserver(() => {
        if (isProcessing) return;
        isProcessing = true;

        organizeTags();

        setTimeout(() => { isProcessing = false; }, 50);
    });

    const targetNode = document.querySelector('.js-tagsauce') || document.body;
    observer.observe(targetNode, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
    });
})();
