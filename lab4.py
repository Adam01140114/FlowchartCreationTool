import torch
import torchvision
import torch.nn as nn
import argparse
import PIL
import random

# TODO 1: Choose a digit
digit = 3  # Change this to your chosen digit (0-9)

# TODO 2: Change number of training iterations for classifier
n0 = 20  # Classifier training iterations

# ... existing code ...
# TODO 6: Change number of total training iterations for GAN, for the discriminator and for the generator
n = 10   # GAN outer loop iterations
n1 = 10  # Discriminator training iterations per GAN loop
n2 = 10  # Generator training iterations per GAN loop
# ... existing code ... 

# TODO 3
# Change Network architecture of the discriminator/classifier network. It should have 784 inputs and 1 output (0 = fake, 1 = real)
class Discriminator(nn.Module):
    def __init__(self):
        super().__init__()
        self.model = nn.Sequential(
            nn.Linear(784, 256),
            nn.LeakyReLU(0.2),
            nn.Linear(256, 1),
            nn.Sigmoid()
        )
    def forward(self, x):
        return self.model(x)

# TODO 4
# Implement training loop for the classifier:
def train_classifier(opt, model, x, y):
    for i in range(n0):
        opt.zero_grad()
        y_pred = model(x)
        loss = loss_fn(y_pred, y)
        loss.backward()
        opt.step()
        print(f"Iteration {i+1}/{n0}, Loss: {loss.item():.4f}")

# TODO 5
# Instantiate the network and the optimizer
# call train_classifier with the training set
# Calculate metrics on the validation set 
def classify(x_train, y_train, x_validation, labels_validation):
    net = Discriminator()
    opt = torch.optim.Adam(net.parameters(), lr=0.001)
    train_classifier(opt, net, x_train, y_train)

    # Validation
    net.eval()
    with torch.no_grad():
        # Use digit_int for robust type handling
        digit_int = int(digit) if not isinstance(digit, int) else digit
        y_pred = net(x_validation)
        y_pred_label = (y_pred > 0.5).float().view(-1)
        true_digit = (labels_validation == digit_int)
        not_digit = ~true_digit
        pred_digit = (y_pred_label == 1)
        pred_not_digit = (y_pred_label == 0)

        TP = (pred_digit & true_digit).sum().item()
        FN = (pred_not_digit & true_digit).sum().item()
        FP = (pred_digit & not_digit).sum().item()
        TN = (pred_not_digit & not_digit).sum().item()
        accuracy = (TP + TN) / (TP + TN + FP + FN)
        precision = TP / (TP + FP) if (TP + FP) > 0 else 0
        recall = TP / (TP + FN) if (TP + FN) > 0 else 0
        print(f"\nValidation Results:")
        print(f"Accuracy: {accuracy*100:.2f}%")
        print(f"Precision: {precision*100:.2f}%")
        print(f"Recall: {recall*100:.2f}%")

        # Per-digit confusion
        confusion = {}
        for d in range(10):
            idx = (labels_validation == d)
            pred_as_digit = (y_pred_label[idx] == 1).sum().item()
            total = idx.sum().item()
            confusion[d] = pred_as_digit / total if total > 0 else 0
            print(f"Digit {d}: {pred_as_digit}/{total} ({confusion[d]*100:.2f}%) predicted as {digit_int}")

        # Save some misclassified images
        misclassified = ((y_pred_label == 1) & not_digit) | ((y_pred_label == 0) & true_digit)
        mis_idx = torch.where(misclassified)[0]
        for i, idx in enumerate(mis_idx[:5]):
            img = x_validation[idx]
            show_image(img, f"misclassified_{i}_label{labels_validation[idx].item()}_pred{int(y_pred_label[idx].item())}.png", scale=SCALE_01)
        # Most/least confused digits
        confusion_sorted = sorted(confusion.items(), key=lambda x: x[1], reverse=True)
        print("\nMost confused with digit {}:".format(digit_int))
        for d, val in confusion_sorted[1:3]:
            print(f"Digit {d}: {val*100:.2f}% mistaken as {digit_int}")
        print("Least confused:")
        for d, val in confusion_sorted[-2:]:
            print(f"Digit {d}: {val*100:.2f}% mistaken as {digit_int}")

# TODO 7
# Change Network architecture of the generator network. It should have 100 inputs (will be random numbers) and 784 outputs (one for each pixel, each between 0 and 1)
class Generator(nn.Module):
    def __init__(self):
        super().__init__()
        self.model = nn.Sequential(
            nn.Linear(100, 256),
            nn.LeakyReLU(0.2),
            nn.Linear(256, 784),
            nn.Sigmoid()
        )
    def forward(self, x):
        return self.model(x)

# TODO 8
# Implement training loop for the discriminator, given real and fake data:
def train_discriminator(opt, discriminator, x_true, x_false):
    for i in range(n1):
        opt.zero_grad()
        # Real images
        y_true_pred = discriminator(x_true)
        loss_true = loss_fn(y_true_pred, torch.ones_like(y_true_pred))
        loss_true.backward()
        # Fake images
        y_false_pred = discriminator(x_false)
        loss_false = loss_fn(y_false_pred, torch.zeros_like(y_false_pred))
        loss_false.backward()
        opt.step()
        print(f"Discriminator Iter {i+1}/{n1}, Real Loss: {loss_true.item():.4f}, Fake Loss: {loss_false.item():.4f}")

# TODO 9 
# Implement training loop for the generator:
def train_generator(opt, generator, discriminator, batch_size=100):
    for i in range(n2):
        opt.zero_grad()
        z = torch.randn(batch_size, 100)
        generated_imgs = generator(z)
        y_pred = discriminator(generated_imgs)
        loss = loss_fn(y_pred, torch.ones_like(y_pred))
        loss.backward()
        opt.step()
        print(f"Generator Iter {i+1}/{n2}, Loss: {loss.item():.4f}") 

# TODO 10
# Implement GAN training loop:
def gan(x_real):
    # Initial fake images
    fake_images = torch.rand((100, 784))
    # Instantiate networks
    generator = Generator()
    discriminator = Discriminator()
    # Optimizers
    opt_g = torch.optim.Adam(generator.parameters(), lr=0.001)
    opt_d = torch.optim.Adam(discriminator.parameters(), lr=0.001)

    for i in range(n):
        print(f"\n--- GAN Iteration {i+1}/{n} ---")
        # Train discriminator on real and fake images
        train_discriminator(opt_d, discriminator, x_real, fake_images)
        # Train generator
        train_generator(opt_g, generator, discriminator)
        # Generate new fake images
        z = torch.randn(100, 100)
        new_fake_images = generator(z).detach()
        # Keep 100 old and 100 new fake images
        if fake_images.shape[0] > 0:
            idx = torch.randperm(fake_images.shape[0])[:100]
            fake_images = torch.cat([fake_images[idx], new_fake_images], dim=0)
        else:
            fake_images = new_fake_images
        # Save some generated images
        for j in range(5):
            show_image(new_fake_images[j], f"sample_{i}_{j}.png", scale=SCALE_01) 

def main(rungan):
    """
    You do not have to change this function!
    
    It will:
        automatically download the data set if it doesn't exist yet
        make sure all tensor shapes are correct
        normalize the images (all pixels between 0 and 1)
        provide labels for the classification task (0 for all images that are not your digit, 1 for the ones that are)
        extract the images of your chosen digit for the GAN
    """
    train = torchvision.datasets.MNIST(".", download=True)
    x_train = train.data.float().view(-1,28*28)/255.0
    labels_train = train.targets
    # Robust type-checking and debug block for y_train assignment
    if not torch.is_tensor(labels_train):
        labels_train = torch.tensor(labels_train)
    if not isinstance(digit, int):
        digit_int = int(digit)
    else:
        digit_int = digit
    # Ensure labels_train is 1D tensor and digit_int is int
    if hasattr(labels_train, 'shape') and len(labels_train.shape) > 1:
        labels_train = labels_train.view(-1)
    # Perform comparison and ensure result is tensor
    result = labels_train == digit_int
    if isinstance(result, bool):
        # If comparison returns bool, convert labels_train and digit_int again
        labels_train = torch.tensor(labels_train)
        digit_int = int(digit_int)
        result = labels_train == digit_int
        if isinstance(result, bool):
            raise RuntimeError(f'Comparison still returns bool! labels_train type: {type(labels_train)}, digit_int type: {type(digit_int)}, labels_train: {labels_train}, digit_int: {digit_int}')
    y_train = result.float().view(-1,1)
    
    validation = torchvision.datasets.MNIST(".", train=False)
    x_validation = validation.data.float().view(-1,28*28)/255.0
    labels_validation = validation.targets
    if not torch.is_tensor(labels_validation):
        labels_validation = torch.tensor(labels_validation)
    
    if rungan:
        gan(x_train[labels_train == digit_int])
    else:
        classify(x_train, y_train, x_validation, labels_validation) 