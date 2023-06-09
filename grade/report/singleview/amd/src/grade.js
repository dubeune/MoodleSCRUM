// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * A small modal to search grade items within the gradebook.
 *
 * @module    gradereport_singleview
 * @copyright 2022 Mathew May <mathew.solutions>
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import * as FocusLockManager from 'core/local/aria/focuslock';
import Pending from 'core/pending';
import * as Templates from 'core/templates';
import Url from 'core/url';
import * as Repository from 'core_grades/searchwidget/repository';
import * as WidgetBase from 'core_grades/searchwidget/basewidget';
import $ from 'jquery';
import * as Selectors from 'core_grades/searchwidget/selectors';

/**
 * Our entry point into starting to build the search widget.
 * It'll eventually, based upon the listeners, open the search widget and allow filtering.
 *
 * @method init
 */
export const init = () => {
    if (document.querySelector(Selectors.elements.getSearchWidgetSelector('grade'))) {
        const pendingPromise = new Pending();
        registerListenerEvents();
        pendingPromise.resolve();
    }
};

/**
 * Register grade item search widget related event listeners.
 *
 * @method registerListenerEvents
 */
const registerListenerEvents = () => {
    let {bodyPromiseResolver, bodyPromise} = WidgetBase.promisesAndResolvers();
    const dropdownMenuContainer = document.querySelector(Selectors.elements.getSearchWidgetDropdownSelector('grade'));
    const menuContainer = document.querySelector(Selectors.elements.getSearchWidgetSelector('grade'));
    const inputElement = menuContainer.querySelector('input[name="itemid"]');

    // Handle the 'shown.bs.dropdown' event (Fired when the dropdown menu is fully displayed).
    $(menuContainer).on('show.bs.dropdown', async(e) => {
        const courseID = e.relatedTarget.dataset.courseid;
        // Display a loading icon in the dropdown menu container until the body promise is resolved.
        await WidgetBase.showLoader(dropdownMenuContainer);

        // If an error occurs while fetching the data, display the error within the modal.
        const data = await Repository.gradeitemFetch(courseID).catch(async(e) => {
            const errorTemplateData = {
                'errormessage': e.message
            };
            bodyPromiseResolver(
                await Templates.render('core_grades/searchwidget/error', errorTemplateData)
            );
        });

        // Early return if there is no module data.
        if (data === []) {
            return;
        }

        await WidgetBase.init(
            dropdownMenuContainer,
            bodyPromise,
            data.gradeitems,
            searchGradeitems(),
            null,
            afterSelect
        );

        // Resolvers for passed functions in the modal creation.
        bodyPromiseResolver(Templates.render('gradereport_singleview/gradesearch_body', []));

        // Lock tab control. It has to be locked because the dropdown's role is dialog.
        FocusLockManager.trapFocus(dropdownMenuContainer);
    });

    // Handle the 'hide.bs.dropdown' event (Fired when the dropdown menu is being closed).
    $(menuContainer).on('hide.bs.dropdown', () => {
        FocusLockManager.untrapFocus();
    });

    inputElement.addEventListener('change', e => {
        const toggle = menuContainer.querySelector('.dropdown-toggle');
        const courseId = toggle.dataset.courseid;
        const actionUrl = Url.relativeUrl(
            '/grade/report/singleview/index.php',
            {
                id: courseId,
                item: 'grade',
                itemid: e.target.value
            },
            false
        );
        location.href = actionUrl;

        e.stopPropagation();
    });
};

/**
 * Define how we want to search and filter grade items when the user decides to input a search value.
 *
 * @method searchGradeitems
 * @returns {function(): function(*, *): (*)}
 */
const searchGradeitems = () => {
    return () => {
        return (modules, searchTerm) => {
            if (searchTerm === '') {
                return modules;
            }
            searchTerm = searchTerm.toLowerCase();
            const searchResults = [];
            modules.forEach((module) => {
                const moduleName = module.name.toLowerCase();
                if (moduleName.includes(searchTerm)) {
                    searchResults.push(module);
                }
            });
            return searchResults;
        };
    };
};

/**
 * Define the action to be performed when an item is selected by the search widget.
 *
 * @param {String} selected The selected item's value.
 */
const afterSelect = (selected) => {
    const menuContainer = document.querySelector(Selectors.elements.getSearchWidgetSelector('grade'));
    const inputElement = menuContainer.querySelector('input[name="itemid"]');

    $(menuContainer).dropdown('hide'); // Otherwise the dropdown stays open when user choose an option using keyboard.

    if (inputElement.value != selected) {
        inputElement.value = selected;
        inputElement.dispatchEvent(new Event('change', {bubbles: true}));
    }
};
