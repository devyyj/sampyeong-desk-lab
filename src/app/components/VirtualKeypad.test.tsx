import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VirtualKeypad from './VirtualKeypad';

describe('VirtualKeypad Component', () => {
  it('renders all 0-9 digits and control buttons', () => {
    render(<VirtualKeypad onInput={() => {}} onDelete={() => {}} onClear={() => {}} />);
    
    // Check that 0-9 keys are present
    for (let i = 0; i <= 9; i++) {
      expect(screen.getByRole('button', { name: i.toString() })).toBeInTheDocument();
    }
    
    expect(screen.getByRole('button', { name: '지우기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
  });

  it('calls onInput when a digit is clicked', () => {
    const handleInput = jest.fn();
    render(<VirtualKeypad onInput={handleInput} onDelete={() => {}} onClear={() => {}} />);
    
    const key = screen.getByRole('button', { name: '5' });
    fireEvent.click(key);
    
    expect(handleInput).toHaveBeenCalledWith('5');
  });

  it('calls onDelete when backspace/delete is clicked', () => {
    const handleDelete = jest.fn();
    render(<VirtualKeypad onInput={() => {}} onDelete={handleDelete} onClear={() => {}} />);
    
    const deleteBtn = screen.getByRole('button', { name: '취소' });
    fireEvent.click(deleteBtn);
    
    expect(handleDelete).toHaveBeenCalled();
  });

  it('calls onClear when clear is clicked', () => {
    const handleClear = jest.fn();
    render(<VirtualKeypad onInput={() => {}} onDelete={() => {}} onClear={handleClear} />);
    
    const clearBtn = screen.getByRole('button', { name: '지우기' });
    fireEvent.click(clearBtn);
    
    expect(handleClear).toHaveBeenCalled();
  });
});
