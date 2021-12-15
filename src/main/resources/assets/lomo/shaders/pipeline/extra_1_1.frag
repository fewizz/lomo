#include frex:shaders/api/view.glsl
#include canvas:shaders/pipeline/pipeline.glsl

layout(location = 0) out vec4 out_extra;

void main() {
	out_extra = vec4(0.0, 1.0, 1.0, 1.0);
}