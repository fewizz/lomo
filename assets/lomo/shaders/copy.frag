uniform sampler2D u_texure;

layout(location = 0) out vec4 out_color;

void main() {
	out_color = texelFetch(u_texure, ivec2(gl_FragCoord.xy), 0);
}