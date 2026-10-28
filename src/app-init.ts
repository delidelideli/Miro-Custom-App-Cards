// Loaded by index.html (the App URL). Runs silently in the background when
// the board opens. Registers the toolbar icon so clicking it opens the panel.
miro.board.ui.on('icon:click', async () => {
  await miro.board.ui.openPanel({ url: '/panel.html' });
});
