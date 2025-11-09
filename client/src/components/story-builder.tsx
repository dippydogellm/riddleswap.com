import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  BookOpen, 
  Plus, 
  Edit, 
  Sparkles, 
  ChevronRight,
  FileText,
  CheckCircle,
  Clock,
  Palette
} from 'lucide-react';

interface Story {
  id: string;
  title: string;
  content: string;
  word_count?: number;
  created_at: string;
  is_published: boolean;
}

interface Book {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  total_chapters?: number;
  total_words?: number;
  status?: string;
  created_at: string;
}

export const StoryBuilder = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [wizardStep, setWizardStep] = useState(0);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  
  const [bookForm, setBookForm] = useState({
    title: '',
    subtitle: '',
    description: '',
    bookType: 'anthology'
  });
  
  const [storyForm, setStoryForm] = useState({
    title: '',
    content: '',
    storyType: 'user_adventure'
  });

  const { data: stories, isLoading: storiesLoading } = useQuery<Story[]>({
    queryKey: ['/api/riddleauthor/stories'],
    retry: 3,
  });

  const { data: books, isLoading: booksLoading } = useQuery<Book[]>({
    queryKey: ['/api/riddleauthor/nft-books'],
    retry: 3,
  });

  const { data: bookStories } = useQuery<Story[]>({
    queryKey: [`/api/riddleauthor/books/${selectedBookId}/stories`],
    enabled: !!selectedBookId,
    retry: 3,
  });

  const createBook = useMutation({
    mutationFn: async (bookData: typeof bookForm) => {
      const result = await apiRequest('/api/riddleauthor/books/create', {
        method: 'POST',
        body: JSON.stringify(bookData),
      });
      return result.json() as Promise<{ success: boolean; book: Book }>;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/riddleauthor/nft-books'] });
      setSelectedBookId(data.book.id);
      setWizardStep(2);
      toast({
        title: "Book Created!",
        description: `${bookForm.title} is ready for chapters.`,
      });
    },
  });

  const createStory = useMutation({
    mutationFn: async (storyData: typeof storyForm & { nftBookId?: string }) => {
      return await apiRequest('/api/riddleauthor/stories/create', {
        method: 'POST',
        body: JSON.stringify(storyData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/riddleauthor/stories'] });
      queryClient.invalidateQueries({ queryKey: [`/api/riddleauthor/books/${selectedBookId}/stories`] });
      setStoryForm({ title: '', content: '', storyType: 'user_adventure' });
      toast({
        title: "Chapter Added!",
        description: "Your story has been saved.",
      });
    },
  });

  const updateStory = useMutation({
    mutationFn: async ({ id, ...storyData }: { id: string } & Partial<typeof storyForm>) => {
      return await apiRequest(`/api/riddleauthor/stories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(storyData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/riddleauthor/stories'] });
      queryClient.invalidateQueries({ queryKey: [`/api/riddleauthor/books/${selectedBookId}/stories`] });
      setEditingStoryId(null);
      toast({
        title: "Story Updated!",
        description: "Your changes have been saved.",
      });
    },
  });

  const mintBook = useMutation({
    mutationFn: async (bookId: string) => {
      const result = await apiRequest(`/api/riddleauthor/books/${bookId}/mint`, {
        method: 'POST',
      });
      return result.json() as Promise<{ success: boolean; message: string; stats: { chapters: number; words: number; title: string } }>;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/riddleauthor/nft-books'] });
      toast({
        title: "Book Ready for NFT Minting!",
        description: `${data.stats.chapters} chapters, ${data.stats.words} words prepared.`,
      });
    },
  });

  const bookTypes = [
    { value: 'anthology', label: 'Anthology Collection', desc: 'Multiple short stories' },
    { value: 'novel', label: 'Novel', desc: 'Long-form single narrative' },
    { value: 'poetry', label: 'Poetry Collection', desc: 'Poems and verses' },
    { value: 'chronicle', label: 'Chronicle', desc: 'Historical or event-based' },
  ];

  const renderWizard = () => {
    if (wizardStep === 0) {
      return (
        <Card className="bg-slate-800/50 border-purple-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" />
              Create New Book
            </CardTitle>
            <CardDescription>Step 1: Choose your book type</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bookTypes.map((type) => (
                <div
                  key={type.value}
                  onClick={() => setBookForm({ ...bookForm, bookType: type.value })}
                  className={`p-4 rounded-lg cursor-pointer border-2 transition-all ${
                    bookForm.bookType === type.value
                      ? 'bg-purple-900/30 border-purple-500'
                      : 'bg-slate-700 border-slate-600 hover:border-purple-400'
                  }`}
                >
                  <h3 className="font-semibold text-white mb-1">{type.label}</h3>
                  <p className="text-sm text-slate-300">{type.desc}</p>
                </div>
              ))}
            </div>
            <Button
              onClick={() => setWizardStep(1)}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              Continue <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (wizardStep === 1) {
      return (
        <Card className="bg-slate-800/50 border-purple-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-400" />
              Book Details
            </CardTitle>
            <CardDescription>Step 2: Name your book</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300">Title</label>
              <Input
                value={bookForm.title}
                onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                placeholder="Enter book title..."
                className="bg-slate-700 border-slate-600 mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">Subtitle (Optional)</label>
              <Input
                value={bookForm.subtitle}
                onChange={(e) => setBookForm({ ...bookForm, subtitle: e.target.value })}
                placeholder="Enter subtitle..."
                className="bg-slate-700 border-slate-600 mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">Description</label>
              <Textarea
                value={bookForm.description}
                onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                placeholder="Describe your book..."
                className="bg-slate-700 border-slate-600 mt-1"
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setWizardStep(0)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={() => createBook.mutate(bookForm)}
                disabled={!bookForm.title || !bookForm.description || createBook.isPending}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                Create Book <Sparkles className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      {wizardStep < 2 ? (
        renderWizard()
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <Card className="bg-slate-800/50 border-purple-500/20 mb-4">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-purple-400" />
                    Your Books
                  </span>
                  <Button
                    size="sm"
                    onClick={() => setWizardStep(0)}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="h-4 w-4 mr-1" /> New Book
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {booksLoading ? (
                    <div className="text-center text-slate-400 py-8">Loading...</div>
                  ) : books && books.length > 0 ? (
                    <div className="space-y-3">
                      {books.map((book) => (
                        <div
                          key={book.id}
                          onClick={() => setSelectedBookId(book.id)}
                          className={`p-4 rounded-lg cursor-pointer border transition-all ${
                            selectedBookId === book.id
                              ? 'bg-purple-900/30 border-purple-500'
                              : 'bg-slate-700 border-slate-600 hover:border-purple-400'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-semibold text-white">{book.title}</h3>
                            <Badge variant="outline" className="text-xs">
                              {book.status || 'draft'}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-300 line-clamp-2 mb-2">{book.description}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span>{book.total_chapters || 0} chapters</span>
                            <span>•</span>
                            <span>{book.total_words || 0} words</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-slate-400 py-8">
                      No books yet. Create your first book!
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div>
            {selectedBookId && (
              <Card className="bg-slate-800/50 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Edit className="h-5 w-5 text-purple-400" />
                      Add Chapter
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => mintBook.mutate(selectedBookId)}
                      disabled={mintBook.isPending || !bookStories || bookStories.length === 0}
                    >
                      <Palette className="h-4 w-4 mr-1" /> Mint as NFT
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Input
                      value={storyForm.title}
                      onChange={(e) => setStoryForm({ ...storyForm, title: e.target.value })}
                      placeholder="Chapter title..."
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                  <div>
                    <Textarea
                      value={storyForm.content}
                      onChange={(e) => setStoryForm({ ...storyForm, content: e.target.value })}
                      placeholder="Write your chapter content..."
                      className="bg-slate-700 border-slate-600"
                      rows={8}
                    />
                  </div>
                  <Button
                    onClick={() => createStory.mutate({ ...storyForm, nftBookId: selectedBookId })}
                    disabled={!storyForm.title || !storyForm.content || createStory.isPending}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Chapter
                  </Button>

                  <div className="mt-6">
                    <h4 className="font-semibold text-white mb-3">Chapters</h4>
                    <ScrollArea className="h-[200px]">
                      {bookStories && bookStories.length > 0 ? (
                        <div className="space-y-2">
                          {bookStories.map((story, idx) => (
                            <div key={story.id} className="p-3 bg-slate-700 rounded-lg">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-white">
                                  {idx + 1}. {story.title}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {story.word_count} words
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-slate-400 py-4">
                          No chapters yet. Add your first chapter above!
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
