uniform sampler2D u_color;

layout(location = 0) out vec4 out_color;

void main() {
	out_color = texelFetch(u_color, ivec2(gl_FragCoord.xy), 0);
}