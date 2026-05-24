let _dragSelectJustCommitted = false;

export function dragSelectJustCommitted(): boolean {
    return _dragSelectJustCommitted;
}

export function setDragSelectJustCommitted(): void {
    _dragSelectJustCommitted = true;
    setTimeout(() => {
        _dragSelectJustCommitted = false;
    }, 0);
}
