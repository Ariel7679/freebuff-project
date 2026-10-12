import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('App (UI)', () => {
  it('merender dashboard dengan data contoh', () => {
    render(<App />);
    expect(screen.getByLabelText('Nama proyek')).toHaveValue('Proyek Portal Manajemen Proyek');
    // Gantt menampilkan tugas seed
    expect(screen.getAllByText('Analisis Kebutuhan').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pengembangan').length).toBeGreaterThan(0);
    expect(screen.getByText(/4 anggota/)).toBeInTheDocument();
  });

  it('menampilkan bar tugas pada area timeline', () => {
    render(<App />);
    const labels = screen.getAllByText('Dokumen Spesifikasi');
    expect(labels.length).toBeGreaterThan(0);
    // minimal ada satu elemen bar
    expect(document.querySelectorAll('.bar').length).toBeGreaterThan(5);
  });

  it('menambah tugas baru lewat modal', () => {
    render(<App />);
    const before = document.querySelectorAll('.bar').length;
    fireEvent.click(screen.getByRole('button', { name: '+ Tugas baru' }));
    fireEvent.change(screen.getByLabelText(/Nama tugas/), { target: { value: 'Tugas Uji Baru' } });
    fireEvent.change(screen.getByLabelText('Durasi (hari kerja)'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tambah tugas' }));
    expect(screen.getAllByText('Tugas Uji Baru').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.bar').length).toBe(before + 1);
  });

  it('menolak tugas tanpa nama', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '+ Tugas baru' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tambah tugas' }));
    expect(screen.getByText('Nama tugas wajib diisi.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('mengedit tugas lewat klik ganda pada bar', () => {
    render(<App />);
    // Label tugas muncul di panel kiri dan di dalam bar; ambil yang berada di bar
    const bars = Array.from(document.querySelectorAll('.bar'));
    const bar = bars.find((b) => b.textContent?.includes('Setup Environment')) as HTMLElement | undefined;
    expect(bar).toBeDefined();
    fireEvent.doubleClick(bar!);
    expect(screen.getByRole('dialog')).toHaveTextContent('Edit Tugas');
    const nameInput = screen.getByLabelText(/Nama tugas/);
    fireEvent.change(nameInput, { target: { value: 'Setup Environment v2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan perubahan' }));
    expect(screen.getAllByText('Setup Environment v2').length).toBeGreaterThan(0);
  });

  it('menghapus tugas terpilih beserta konfirmasi', () => {
    render(<App />);
    const target = screen.getAllByText('Setup Environment')[0];
    const row = target.closest('.gantt-row') as HTMLElement;
    fireEvent.click(row);
    fireEvent.click(screen.getByRole('button', { name: 'Hapus' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(screen.queryAllByText('Setup Environment')).toHaveLength(0);
  });

  it('beralih ke tab Sumber Daya dan menampilkan anggota', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Sumber Daya' }));
    expect(screen.getByText('Ariel Pratama')).toBeInTheDocument();
    expect(screen.getByText(/Total gaji bulanan/)).toBeInTheDocument();
  });

  it('menambah anggota tim baru', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Sumber Daya' }));
    const card = screen.getByText('Tambah anggota').closest('.card') as HTMLElement;
    fireEvent.change(within(card).getByPlaceholderText('Nama lengkap'), { target: { value: 'Rina Amelia' } });
    fireEvent.change(within(card).getByPlaceholderText('nama@perusahaan.com'), { target: { value: 'rina@freebuff.id' } });
    fireEvent.change(within(card).getByPlaceholderText('12000000'), { target: { value: '9500000' } });
    fireEvent.click(within(card).getByRole('button', { name: '+ Tambah anggota' }));
    expect(within(card).getByRole('button', { name: '+ Tambah anggota' })).toBeInTheDocument();
    expect(screen.getByText('Rina Amelia')).toBeInTheDocument();
    // Meta bar atas memakai matcher lentur karena teksnya hasil interpolasi
    expect(screen.getByText(/\b5 anggota\b/)).toBeInTheDocument();
  });

  it('menambah hari libur di tab Kalender', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Kalender' }));
    fireEvent.change(screen.getByLabelText('Tanggal'), { target: { value: '2026-11-17' } });
    fireEvent.change(screen.getByLabelText('Nama libur'), { target: { value: 'Libur Khusus' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Tambah libur' }));
    expect(screen.getByText('Libur Khusus')).toBeInTheDocument();
    // Daftar hari libur kini berisi 4 entri
    expect(document.querySelectorAll('.holiday-list li')).toHaveLength(4);
  });

  it('mengubah pengaturan akhir pekan', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Kalender' }));
    const sen = screen.getByRole('button', { name: 'Sen' });
    expect(sen).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(sen);
    expect(sen).toHaveAttribute('aria-pressed', 'true');
  });

  it('tab Analisis menampilkan jalur kritis dan diagram PERT', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Analisis' }));
    expect(screen.getByText('Jalur Kritis (Critical Path)')).toBeInTheDocument();
    expect(screen.getByText('Diagram PERT')).toBeInTheDocument();
    expect(screen.getByLabelText('Diagram PERT')).toBeInTheDocument();
    expect(screen.getByText(/Estimasi PERT per tugas/)).toBeInTheDocument();
    // jalur kritis seed minimal berisi tugas akhir (muncul di list & tabel PERT)
    expect(screen.getAllByText('Peluncuran Produk').length).toBeGreaterThanOrEqual(2);
  });

  it('menyimpan perubahan ke localStorage', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '+ Tugas baru' }));
    fireEvent.change(screen.getByLabelText(/Nama tugas/), { target: { value: 'Tugas Disimpan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tambah tugas' }));
    const raw = window.localStorage.getItem('freebuff-project-state-v1');
    expect(raw).toBeTruthy();
    expect(raw).toContain('Tugas Disimpan');
  });
});
