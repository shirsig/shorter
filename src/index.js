import * as H from "@funkia/hareactive";
import {runComponent, elements as E, list, component} from "@funkia/turbine";
import {withEffectsP, callP} from "@funkia/io";

const enter = 13;
const esc = 27;

const getShortcutsMock = callP(
    () => new Promise(resolve => {
        setTimeout(() => {
            resolve([
                { id: -1, key: 'abc', url: 'http://fskefjkj.com'},
                { id: -2, key: 'bur', url: 'http://skejhkjk.com'},
                { id: -3, key: 'pluka', url: 'http://xxxxxxxxx.com'},
                { id: -4, key: 'gleki', url: 'http://jskjddkkx.com'},
                { id: -5, key: 'xxx', url: 'http://sfjejgjksjk.com'},
            ]);
        }, 2000);
    })
);

let id = 0;
const createShortcutMock = withEffectsP(
    shortcut => new Promise(resolve => {
        setTimeout(() => {
            resolve(Object.assign({ id: id++ }, shortcut));
        }, 2000);
    })
);

const getShortcuts = callP(
    () => fetch('http://localhost:8080/shortcuts').then(response => response.json())
);

const createShortcut = withEffectsP(
    shortcut => fetch('http://localhost:8080/shortcuts', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(shortcut)}).then(response => response.json())
);

const editShortcut = withEffectsP(
    shortcut => fetch('http://localhost:8080/shortcuts', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(shortcut)})
);

const deleteShortcut = withEffectsP(
    id => fetch('http://localhost:8080/shortcuts/' + id, {method: 'DELETE'})
);

const counterList = component((on, start) => {
    const deletion$ = H.shiftCurrent(
        on.shortcutOutputs.map(list => list.length ? H.combine(...list.map(o => o.destroyItemId)) : H.empty)
    );
    start(H.performStream(deletion$.map(deleteShortcut)));
    const deletedIds = start(H.accum((x, xs) => Object.assign({[x]: true}, xs), Object.create(null), deletion$));
    const existingShortcuts = H.stepTo([], start(H.performIO(getShortcutsMock)));
    const resetShortcutInput$ = start(H.delay(0, on.addShortcut)).mapTo('');
    const shortcutInput = H.lift((key, url) => ({key, url}), on.shortcutKeyInput, on.shortcutUrlInput);
    const nextShortcut$ = H.snapshot(shortcutInput, on.addShortcut);
    const createdShortcut$ = start(H.flatFuturesOrdered(start(H.performStream(nextShortcut$.map(createShortcutMock)))));
    const shortcuts = start(H.accum((x, xs) => [...xs, x], [], createdShortcut$));
    const filteredShortcuts = H.lift((xs, ys, deleted, searchTerm) => [...xs, ...ys].filter(x => !deleted[x.id] && x.key.includes(searchTerm)), existingShortcuts, shortcuts, deletedIds, on.searchTerm);
    return [
        E.div({class: 'container'}, [
            E.div({class: ['columns', 'is-centered']}, [
                E.div({class: ['column', 'is-5']}, [
                    E.h1({class: 'title'}, 'Shortcuts'),
                    E.div({class: 'columns'}, [
                        E.div({class: 'column is-one-quarter'}, [
                            E.button({class: 'button'}, 'Add shortcut').use({
                                addShortcut: 'click'
                            }),
                        ]),
                        E.div({class: 'column is-one-quarter'}, [
                            E.input({class: 'input', placeholder: 'Key', value: resetShortcutInput$}).use({shortcutKeyInput: 'value', shortcutKeyInputChange: 'change'}),
                        ]),
                        E.div({class: 'column is-two-quarters'}, [
                            E.input({class: 'input', placeholder: 'Url', value: resetShortcutInput$}).use({shortcutUrlInput: 'value'}),
                        ]),
                    ]),
                    E.input({class: 'input', placeholder: 'Search shortcuts...'}).use({searchTerm: 'value'}),
                    E.br,
                    list(x => shortcut(x).use({destroyItemId: 'destroyItemId'}), filteredShortcuts, o => o.id).use(o => ({shortcutOutputs: o})),
                ]),
            ]),
        ]),
    ];
});

const shortcut = props =>
    component((on, start) => {
        const editing = start(H.toggle(false, on.startEditing, on.stopEditing));
        const nameChange = H.snapshot(
            on.newName,
            on.stopEditing.filter(b => b)
        );
        const url = start(H.stepper(props.url, nameChange));
        const destroyItemId = on.deleteClicked.mapTo(props.id);
        return E.div({class: ['shortcut', 'box', 'mt-3', {editing}]}, [
            E.div([
                E.div({class: 'is-flex mb-2'}, [
                    E.div({class: 'is-size-6'}, props.key),
                    E.div({class: 'is-flex-grow-1'}),
                    E.button({class: 'button is-small is-danger is-outlined is-pulled-right'}, 'X').use({deleteClicked: 'click'}),
                ]),
                E.div({class: 'is-size-5'}, [
                    E.div({class: 'is-fullwidth url'}, url).use({startEditing: 'click'}),
                    E.input({
                        class: ['input', 'url-editor'],
                        value: H.snapshot(url, on.startEditing),
                        actions: {focus: start(H.delay(0, on.startEditing))},
                    }).use(o => ({
                        newName: o.value,
                        stopEditing: H.combine(
                            o.keyup.filter(ev => ev.keyCode === enter).mapTo(true),
                            H.keepWhen(o.blur, editing).mapTo(true),
                            o.keyup.filter(ev => ev.keyCode === esc).mapTo(false)
                        ),
                    })),
                ]),
            ]),
        ]).output({destroyItemId, id: props.id});
    });

runComponent("#mount", counterList);
